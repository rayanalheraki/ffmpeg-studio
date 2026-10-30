import { defineOperation } from '../types';
import { audioEncoderFor, containerFlags, videoEncoderArgs } from '../helpers/encoders';
import { atempoChain, round } from '../helpers/filters';
import { audioContainer, h264Container, primaryFile } from '../helpers/streams';
import { t } from '../../i18n';

type Options = {
  speed: number;
  audio: string;
};

export default defineOperation<Options>({
  id: 'change-speed',
  label: 'Change speed',
  description: 'Speed up or slow down from 0.25x to 4x while keeping the audio pitch natural.',
  category: 'edit',
  icon: 'Gauge',
  order: 6,
  batch: 'perFile',
  input: { accept: ['video', 'audio'] },
  outputSuffix: (o) => `${round(o.speed, 2)}x`,
  options: [
    { key: 'speed', type: 'slider', label: 'Speed', min: 0.25, max: 4, step: 0.05, default: 1.5, unit: 'x', precision: 2 },
    {
      key: 'audio',
      type: 'segmented',
      label: 'Audio',
      default: 'keep',
      choices: [
        { value: 'keep', label: 'Keep', hint: 'Time-stretched with pitch preserved' },
        { value: 'mute', label: 'Remove' },
      ],
    },
  ],
  outputExtension: (_o, file) => (file.hasVideo ? h264Container(file) : audioContainer(file)),
  expectedDuration: (o, inputs) => {
    const duration = primaryFile(inputs).duration;
    return duration == null ? null : duration / o.speed;
  },
  validate: (o, inputs) => {
    if (Math.abs(o.speed - 1) < 0.001) return t('Choose a speed other than 1x.');
    const file = primaryFile(inputs);
    if (!file.hasVideo && o.audio === 'mute') return t('Removing audio from an audio-only file would leave nothing to export.');
    return null;
  },
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    const speed = round(o.speed, 4);
    const args = ['-i', file.path];
    const keepAudio = file.hasAudio && o.audio === 'keep';

    if (file.hasVideo) {
      const container = h264Container(file);
      args.push('-filter:v', `setpts=PTS/${speed}`, ...videoEncoderArgs('h264', 20, 'medium', container));
      if (keepAudio) args.push('-filter:a', atempoChain(speed), ...audioEncoderFor(container));
      else args.push('-an');
      args.push(...containerFlags(container));
    } else {
      args.push('-vn', '-filter:a', atempoChain(speed), ...audioEncoderFor(audioContainer(file)));
    }
    return [...args, ctx.output];
  },
});
