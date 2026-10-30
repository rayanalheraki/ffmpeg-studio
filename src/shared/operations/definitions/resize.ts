import { defineOperation, type Dimensions } from '../types';
import { QUALITY_CHOICES } from '../helpers/encoders';
import { even } from '../helpers/filters';
import { primaryFile, visualEncodeArgs, visualExtension } from '../helpers/streams';

type Options = {
  preset: string;
  size: Dimensions;
  noUpscale: boolean;
  quality: string;
};

const PRESET_HEIGHTS: Record<string, number> = { '2160': 2160, '1080': 1080, '720': 720, '480': 480 };

/** Scale expression for the chosen size. Locked aspect lets FFmpeg compute the height from the source. */
export function scaleFilter(o: Options): string {
  const presetHeight = PRESET_HEIGHTS[o.preset];
  if (presetHeight) {
    const target = o.noUpscale ? `'min(ih,${presetHeight})'` : String(presetHeight);
    return `scale=-2:${target}:flags=lanczos`;
  }
  const width = even(o.size.width);
  const w = o.noUpscale ? `'min(iw,${width})'` : String(width);
  if (o.size.lockAspect) return `scale=${w}:-2:flags=lanczos`;
  const height = even(o.size.height);
  const h = o.noUpscale ? `'min(ih,${height})'` : String(height);
  return `scale=${w}:${h}:flags=lanczos,setsar=1`;
}

export default defineOperation<Options>({
  id: 'resize',
  label: 'Resize',
  description: 'Change the resolution of videos and images.',
  category: 'edit',
  icon: 'Scaling',
  order: 3,
  batch: 'perFile',
  input: { accept: ['video', 'image'] },
  outputSuffix: (o) => (o.preset === 'custom' ? 'resized' : `${o.preset}p`),
  options: [
    {
      key: 'preset',
      type: 'segmented',
      label: 'Resolution',
      default: '1080',
      choices: [
        { value: '2160', label: '4K', hint: '3840×2160' },
        { value: '1080', label: '1080p', hint: '1920×1080' },
        { value: '720', label: '720p', hint: '1280×720' },
        { value: '480', label: '480p', hint: '854×480' },
        { value: 'custom', label: 'Custom' },
      ],
    },
    {
      key: 'size',
      type: 'dimensions',
      label: 'Custom size',
      description: 'With the aspect ratio locked, height follows the source proportions.',
      default: { width: 1280, height: 720, lockAspect: true },
      min: 16,
      max: 8192,
      visibleWhen: (o) => o.preset === 'custom',
    },
    { key: 'noUpscale', type: 'toggle', label: 'Never upscale smaller files', default: true },
    { key: 'quality', type: 'segmented', label: 'Video quality', default: 'high', choices: QUALITY_CHOICES },
  ],
  outputExtension: (_o, file) => visualExtension(file),
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    return ['-i', file.path, '-vf', scaleFilter(o), ...visualEncodeArgs(file, o.quality), ctx.output];
  },
});
