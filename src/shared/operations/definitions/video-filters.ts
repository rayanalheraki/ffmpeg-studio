import { defineOperation } from '../types';
import { round } from '../helpers/filters';
import { primaryFile, visualEncodeArgs, visualExtension } from '../helpers/streams';

type Options = {
  brightness: number;
  contrast: number;
  saturation: number;
  denoise: string;
  stabilize: boolean;
};

const DENOISE: Record<string, string> = {
  light: 'hqdn3d=2:1.5:3:2.25',
  medium: 'hqdn3d=4:3:6:4.5',
  strong: 'hqdn3d=8:6:12:9',
};

export function videoFilterChain(o: Options): string[] {
  const filters: string[] = [];
  if (o.stabilize) filters.push('deshake');
  const denoise = DENOISE[o.denoise];
  if (denoise) filters.push(denoise);

  const eq: string[] = [];
  if (o.brightness !== 0) eq.push(`brightness=${round(o.brightness / 100, 3)}`);
  if (o.contrast !== 100) eq.push(`contrast=${round(o.contrast / 100, 3)}`);
  if (o.saturation !== 100) eq.push(`saturation=${round(o.saturation / 100, 3)}`);
  if (eq.length > 0) filters.push(`eq=${eq.join(':')}`);
  return filters;
}

export default defineOperation<Options>({
  id: 'video-filters',
  label: 'Video filters',
  description: 'Adjust brightness, contrast and saturation, reduce noise and stabilize shaky footage.',
  category: 'effects',
  icon: 'WandSparkles',
  order: 1,
  batch: 'perFile',
  input: { accept: ['video', 'image'] },
  outputSuffix: 'filtered',
  options: [
    { key: 'brightness', type: 'slider', label: 'Brightness', min: -50, max: 50, step: 1, default: 0, unit: '%' },
    { key: 'contrast', type: 'slider', label: 'Contrast', min: 0, max: 200, step: 1, default: 100, unit: '%' },
    { key: 'saturation', type: 'slider', label: 'Saturation', min: 0, max: 300, step: 1, default: 100, unit: '%' },
    {
      key: 'denoise',
      type: 'segmented',
      label: 'Denoise',
      default: 'off',
      choices: [
        { value: 'off', label: 'Off' },
        { value: 'light', label: 'Light' },
        { value: 'medium', label: 'Medium' },
        { value: 'strong', label: 'Strong' },
      ],
    },
    {
      key: 'stabilize',
      type: 'toggle',
      label: 'Stabilize',
      description: 'Reduce camera shake. Edges may be slightly cropped.',
      default: false,
    },
  ],
  outputExtension: (_o, file) => visualExtension(file),
  validate: (o) => (videoFilterChain(o).length === 0 ? 'Change at least one setting to apply a filter.' : null),
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    return ['-i', file.path, '-vf', videoFilterChain(o).join(','), ...visualEncodeArgs(file), ctx.output];
  },
});
