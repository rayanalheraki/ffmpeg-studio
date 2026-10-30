import { defineOperation } from '../types';
import { even } from '../helpers/filters';
import { primaryFile, visualEncodeArgs, visualExtension } from '../helpers/streams';

type Options = {
  mode: string;
  aspect: string;
  width: number;
  height: number;
  center: boolean;
  x: number;
  y: number;
};

const ASPECTS: Record<string, [number, number]> = {
  '16:9': [16, 9],
  '9:16': [9, 16],
  '1:1': [1, 1],
  '4:3': [4, 3],
  '4:5': [4, 5],
  '21:9': [21, 9],
};

/** Centered crop to an aspect ratio, using the largest area that fits the source. */
function aspectCrop(aspect: string): string {
  const [a, b] = ASPECTS[aspect] ?? [16, 9];
  return `crop=w='trunc(min(iw,ih*${a}/${b})/2)*2':h='trunc(min(ih,iw*${b}/${a})/2)*2'`;
}

export default defineOperation<Options>({
  id: 'crop',
  label: 'Crop',
  description: 'Crop to a preset aspect ratio or an exact region.',
  category: 'edit',
  icon: 'Crop',
  order: 4,
  batch: 'perFile',
  input: { accept: ['video', 'image'] },
  outputSuffix: 'cropped',
  options: [
    {
      key: 'mode',
      type: 'segmented',
      label: 'Crop by',
      default: 'aspect',
      choices: [
        { value: 'aspect', label: 'Aspect ratio' },
        { value: 'custom', label: 'Exact size' },
      ],
    },
    {
      key: 'aspect',
      type: 'segmented',
      label: 'Aspect ratio',
      default: '1:1',
      choices: Object.keys(ASPECTS).map((value) => ({ value, label: value })),
      visibleWhen: (o) => o.mode === 'aspect',
    },
    {
      key: 'width',
      type: 'number',
      label: 'Width',
      min: 2,
      max: 8192,
      step: 2,
      default: 1280,
      unit: 'px',
      span: 'half',
      visibleWhen: (o) => o.mode === 'custom',
    },
    {
      key: 'height',
      type: 'number',
      label: 'Height',
      min: 2,
      max: 8192,
      step: 2,
      default: 720,
      unit: 'px',
      span: 'half',
      visibleWhen: (o) => o.mode === 'custom',
    },
    { key: 'center', type: 'toggle', label: 'Center the crop area', default: true, visibleWhen: (o) => o.mode === 'custom' },
    {
      key: 'x',
      type: 'number',
      label: 'Left offset',
      min: 0,
      max: 8192,
      step: 1,
      default: 0,
      unit: 'px',
      span: 'half',
      visibleWhen: (o) => o.mode === 'custom' && !o.center,
    },
    {
      key: 'y',
      type: 'number',
      label: 'Top offset',
      min: 0,
      max: 8192,
      step: 1,
      default: 0,
      unit: 'px',
      span: 'half',
      visibleWhen: (o) => o.mode === 'custom' && !o.center,
    },
  ],
  outputExtension: (_o, file) => visualExtension(file),
  validate: (o, inputs) => {
    if (o.mode !== 'custom') return null;
    const file = primaryFile(inputs);
    if (file.width == null || file.height == null) return null;
    const x = o.center ? 0 : o.x;
    const y = o.center ? 0 : o.y;
    if (o.width + x > file.width || o.height + y > file.height) {
      return `The crop area is larger than ${file.fileName} (${file.width}×${file.height}).`;
    }
    return null;
  },
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    const filter =
      o.mode === 'aspect'
        ? aspectCrop(o.aspect)
        : `crop=${even(o.width)}:${even(o.height)}${o.center ? '' : `:${Math.round(o.x)}:${Math.round(o.y)}`}`;
    return ['-i', file.path, '-vf', filter, ...visualEncodeArgs(file), ctx.output];
  },
});
