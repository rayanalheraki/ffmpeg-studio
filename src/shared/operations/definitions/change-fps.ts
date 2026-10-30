import { defineOperation } from '../types';
import { containerFlags, videoEncoderArgs } from '../helpers/encoders';
import { audioCopyOrEncode, h264Container, primaryFile } from '../helpers/streams';

type Options = {
  fps: string;
  customFps: number;
  method: string;
};

/** NTSC rates are written as exact fractions. */
const FRACTIONS: Record<string, string> = { '23.976': '24000/1001', '29.97': '30000/1001', '59.94': '60000/1001' };

function targetRate(o: Options): string {
  if (o.fps === 'custom') return String(o.customFps);
  return FRACTIONS[o.fps] ?? o.fps;
}

export default defineOperation<Options>({
  id: 'change-fps',
  label: 'Change frame rate',
  description: 'Convert videos to a different frame rate.',
  category: 'edit',
  icon: 'Film',
  order: 7,
  batch: 'perFile',
  input: { accept: ['video'] },
  outputSuffix: (o) => `${o.fps === 'custom' ? o.customFps : o.fps}fps`,
  options: [
    {
      key: 'fps',
      type: 'segmented',
      label: 'Frame rate',
      default: '30',
      choices: ['23.976', '24', '25', '29.97', '30', '50', '60']
        .map((value) => ({ value, label: value }))
        .concat({
          value: 'custom',
          label: 'Custom',
        }),
    },
    {
      key: 'customFps',
      type: 'number',
      label: 'Custom frame rate',
      min: 1,
      max: 240,
      step: 1,
      default: 30,
      unit: 'fps',
      visibleWhen: (o) => o.fps === 'custom',
    },
    {
      key: 'method',
      type: 'segmented',
      label: 'Method',
      default: 'fps',
      choices: [
        { value: 'fps', label: 'Drop / duplicate', hint: 'Fast and sharp' },
        { value: 'blend', label: 'Blend frames', hint: 'Smoother motion when changing rates' },
      ],
    },
  ],
  outputExtension: (_o, file) => h264Container(file),
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    const container = h264Container(file);
    const rate = targetRate(o);
    const filter = o.method === 'blend' ? `framerate=fps=${rate}` : `fps=${rate}`;
    return [
      '-i',
      file.path,
      '-vf',
      filter,
      ...videoEncoderArgs('h264', 20, 'medium', container),
      ...audioCopyOrEncode(file, container),
      ...containerFlags(container),
      ctx.output,
    ];
  },
});
