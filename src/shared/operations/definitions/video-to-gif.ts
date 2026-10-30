import { parseTime, toFfmpegTime } from '../../utils/time';
import { defineOperation } from '../types';
import { primaryFile } from '../helpers/streams';
import { t } from '../../i18n';

type Options = {
  fps: number;
  width: string;
  start: string;
  duration: number;
  dither: string;
  loop: boolean;
};

export default defineOperation<Options>({
  id: 'video-to-gif',
  label: 'Video to GIF',
  description: 'Create high-quality animated GIFs using palette generation.',
  category: 'convert',
  icon: 'Clapperboard',
  order: 4,
  batch: 'perFile',
  input: { accept: ['video'] },
  outputSuffix: 'gif',
  options: [
    { key: 'fps', type: 'slider', label: 'Frame rate', min: 5, max: 30, step: 1, default: 12, unit: 'fps' },
    {
      key: 'width',
      type: 'segmented',
      label: 'Width',
      default: '480',
      choices: [
        { value: '320', label: '320 px' },
        { value: '480', label: '480 px' },
        { value: '640', label: '640 px' },
        { value: '800', label: '800 px' },
        { value: 'original', label: 'Original' },
      ],
    },
    { key: 'start', type: 'time', label: 'Start at', default: '', placeholder: '00:00:00', span: 'half' },
    {
      key: 'duration',
      type: 'number',
      label: 'Length',
      description: 'Set to 0 to use the whole video.',
      min: 0,
      max: 600,
      step: 0.5,
      default: 0,
      unit: 's',
      span: 'half',
    },
    {
      key: 'dither',
      type: 'select',
      label: 'Dithering',
      default: 'sierra2_4a',
      choices: [
        { value: 'sierra2_4a', label: 'Smooth', hint: 'Best for most videos' },
        { value: 'bayer', label: 'Pattern', hint: 'Smaller files, visible texture' },
        { value: 'none', label: 'None', hint: 'Flat colors, smallest files' },
      ],
    },
    { key: 'loop', type: 'toggle', label: 'Loop forever', default: true },
  ],
  outputExtension: () => 'gif',
  expectedDuration: (o, inputs) => {
    const total = primaryFile(inputs).duration;
    const start = parseTime(o.start) ?? 0;
    if (o.duration > 0) return o.duration;
    return total == null ? null : Math.max(0, total - start);
  },
  validate: (o, inputs) => {
    const start = parseTime(o.start);
    if (o.start.trim() !== '' && start == null) return t('Start time is not a valid timestamp.');
    const total = primaryFile(inputs).duration;
    if (start != null && total != null && start >= total) return t('Start time is beyond the end of the video.');
    return null;
  },
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    const start = parseTime(o.start);
    const args: string[] = [];
    if (start != null && start > 0) args.push('-ss', toFfmpegTime(start));
    if (o.duration > 0) args.push('-t', String(o.duration));
    args.push('-i', file.path);

    const scale = o.width === 'original' ? '' : `,scale=${o.width}:-1:flags=lanczos`;
    const dither = ['sierra2_4a', 'bayer', 'none'].includes(o.dither) ? o.dither : 'sierra2_4a';
    const graph = `[0:v]fps=${o.fps}${scale},split[s0][s1];` + `[s0]palettegen=stats_mode=diff[p];` + `[s1][p]paletteuse=dither=${dither}`;
    return [...args, '-filter_complex', graph, '-loop', o.loop ? '0' : '-1', ctx.output];
  },
});
