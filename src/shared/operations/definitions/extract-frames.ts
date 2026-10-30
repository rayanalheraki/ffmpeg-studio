import { parseTime, toFfmpegTime } from '../../utils/time';
import { defineOperation } from '../types';
import { primaryFile } from '../helpers/streams';
import { t } from '../../i18n';

type Options = {
  mode: string;
  interval: number;
  timestamp: string;
  format: string;
  width: string;
};

const FORMAT_ARGS: Record<string, string[]> = {
  png: [],
  jpg: ['-q:v', '2'],
  webp: ['-c:v', 'libwebp', '-quality', '90'],
};

export default defineOperation<Options>({
  id: 'extract-frames',
  label: 'Extract frames',
  description: 'Save still images every few seconds or at an exact moment.',
  category: 'tools',
  icon: 'Camera',
  order: 2,
  batch: 'perFile',
  input: { accept: ['video'] },
  outputSuffix: 'frame',
  options: [
    {
      key: 'mode',
      type: 'segmented',
      label: 'Capture',
      default: 'interval',
      choices: [
        { value: 'interval', label: 'Every N seconds' },
        { value: 'timestamp', label: 'Single frame' },
      ],
    },
    {
      key: 'interval',
      type: 'number',
      label: 'Interval',
      min: 0.1,
      max: 3600,
      step: 0.5,
      default: 5,
      unit: 's',
      span: 'half',
      visibleWhen: (o) => o.mode === 'interval',
    },
    {
      key: 'timestamp',
      type: 'time',
      label: 'Timestamp',
      default: '00:00:01',
      placeholder: '00:00:01',
      span: 'half',
      visibleWhen: (o) => o.mode === 'timestamp',
    },
    {
      key: 'format',
      type: 'segmented',
      label: 'Image format',
      default: 'jpg',
      choices: [
        { value: 'jpg', label: 'JPG' },
        { value: 'png', label: 'PNG', hint: 'Lossless, larger files' },
        { value: 'webp', label: 'WebP' },
      ],
    },
    {
      key: 'width',
      type: 'select',
      label: 'Image width',
      default: 'original',
      span: 'half',
      choices: [
        { value: 'original', label: 'Original size' },
        { value: '1920', label: '1920 px' },
        { value: '1280', label: '1280 px' },
        { value: '640', label: '640 px' },
        { value: '320', label: '320 px' },
      ],
    },
  ],
  outputExtension: (o) => (FORMAT_ARGS[o.format] ? o.format : 'jpg'),
  outputSequence: (o) => o.mode === 'interval',
  expectedDuration: (o, inputs) => (o.mode === 'interval' ? primaryFile(inputs).duration : null),
  validate: (o, inputs) => {
    if (o.mode !== 'timestamp') return null;
    const time = parseTime(o.timestamp);
    if (time == null) return t('Enter a valid timestamp, such as 00:01:30.');
    const duration = primaryFile(inputs).duration;
    if (duration != null && time >= duration) return t('The timestamp is beyond the end of the video.');
    return null;
  },
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    const scale = o.width === 'original' ? null : `scale=${o.width}:-2`;
    const formatArgs = FORMAT_ARGS[o.format] ?? FORMAT_ARGS.jpg;

    if (o.mode === 'timestamp') {
      const time = parseTime(o.timestamp) ?? 0;
      const vf = scale ? ['-vf', scale] : [];
      return ['-ss', toFfmpegTime(time), '-i', file.path, '-frames:v', '1', ...vf, ...formatArgs, '-update', '1', ctx.output];
    }
    const filters = [`fps=1/${o.interval}`, ...(scale ? [scale] : [])].join(',');
    return ['-i', file.path, '-vf', filters, ...formatArgs, ctx.output];
  },
});
