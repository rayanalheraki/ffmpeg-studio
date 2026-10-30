import { defineOperation } from '../types';
import { primaryFile, visualEncodeArgs, visualExtension } from '../helpers/streams';
import { t } from '../../i18n';

type Options = {
  rotation: string;
  flipHorizontal: boolean;
  flipVertical: boolean;
};

const ROTATION_FILTERS: Record<string, string[]> = {
  '0': [],
  '90': ['transpose=clock'],
  '180': ['hflip', 'vflip'],
  '270': ['transpose=cclock'],
};

export function rotateFilters(o: Options): string[] {
  return [...(ROTATION_FILTERS[o.rotation] ?? []), ...(o.flipHorizontal ? ['hflip'] : []), ...(o.flipVertical ? ['vflip'] : [])];
}

export default defineOperation<Options>({
  id: 'rotate-flip',
  label: 'Rotate & flip',
  description: 'Rotate by 90° steps or mirror videos and images.',
  category: 'edit',
  icon: 'RotateCw',
  order: 5,
  batch: 'perFile',
  input: { accept: ['video', 'image'] },
  outputSuffix: 'rotated',
  options: [
    {
      key: 'rotation',
      type: 'segmented',
      label: 'Rotate',
      default: '90',
      choices: [
        { value: '0', label: 'None' },
        { value: '90', label: '90° right' },
        { value: '180', label: '180°' },
        { value: '270', label: '90° left' },
      ],
    },
    { key: 'flipHorizontal', type: 'toggle', label: 'Flip horizontally', description: 'Mirror left and right.', default: false },
    { key: 'flipVertical', type: 'toggle', label: 'Flip vertically', description: 'Mirror top and bottom.', default: false },
  ],
  outputExtension: (_o, file) => visualExtension(file),
  validate: (o) => (rotateFilters(o).length === 0 ? t('Choose a rotation or a flip direction.') : null),
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    return ['-i', file.path, '-vf', rotateFilters(o).join(','), ...visualEncodeArgs(file), ctx.output];
  },
});
