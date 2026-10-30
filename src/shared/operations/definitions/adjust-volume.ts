import { defineOperation } from '../types';
import { audioEncoderFor, containerFlags } from '../helpers/encoders';
import { audioContainer, primaryFile } from '../helpers/streams';

type Options = {
  mode: string;
  gain: number;
  target: string;
  limiter: boolean;
};

export function volumeFilter(o: Options): string {
  if (o.mode === 'normalize') {
    const lufs = ['-14', '-16', '-23'].includes(o.target) ? o.target : '-16';
    return `loudnorm=I=${lufs}:TP=-1.5:LRA=11`;
  }
  const gain = `volume=${o.gain}dB`;
  return o.limiter ? `${gain},alimiter=limit=0.97:level=disabled` : gain;
}

export default defineOperation<Options>({
  id: 'adjust-volume',
  label: 'Volume & normalize',
  description: 'Make audio louder or quieter, or normalize loudness to a standard.',
  category: 'audio',
  icon: 'Volume2',
  order: 3,
  batch: 'perFile',
  input: { accept: ['video', 'audio'] },
  outputSuffix: (o) => (o.mode === 'normalize' ? 'normalized' : 'volume'),
  options: [
    {
      key: 'mode',
      type: 'segmented',
      label: 'Mode',
      default: 'normalize',
      choices: [
        { value: 'normalize', label: 'Normalize', hint: 'Consistent loudness (EBU R128)' },
        { value: 'adjust', label: 'Adjust', hint: 'Change volume by a fixed amount' },
      ],
    },
    {
      key: 'gain',
      type: 'slider',
      label: 'Gain',
      min: -30,
      max: 30,
      step: 1,
      default: 6,
      unit: 'dB',
      visibleWhen: (o) => o.mode === 'adjust',
    },
    {
      key: 'limiter',
      type: 'toggle',
      label: 'Prevent clipping',
      description: 'Apply a limiter so louder audio does not distort.',
      default: true,
      visibleWhen: (o) => o.mode === 'adjust',
    },
    {
      key: 'target',
      type: 'select',
      label: 'Loudness target',
      default: '-16',
      visibleWhen: (o) => o.mode === 'normalize',
      choices: [
        { value: '-14', label: 'Streaming · −14 LUFS', hint: 'Spotify, YouTube' },
        { value: '-16', label: 'Podcast · −16 LUFS', hint: 'Apple Podcasts, voice' },
        { value: '-23', label: 'Broadcast · −23 LUFS', hint: 'TV (EBU R128)' },
      ],
    },
  ],
  outputExtension: (_o, file) => audioContainer(file),
  validate: (o, inputs) => {
    if (!primaryFile(inputs).hasAudio) return 'This file has no audio track.';
    if (o.mode === 'adjust' && o.gain === 0) return 'Choose a gain other than 0 dB.';
    return null;
  },
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    const container = audioContainer(file);
    const video = file.hasVideo ? ['-map', '0:v:0', '-c:v', 'copy'] : ['-vn'];
    return [
      '-i',
      file.path,
      ...video,
      '-map',
      '0:a:0',
      '-filter:a',
      volumeFilter(o),
      ...(o.mode === 'normalize' ? ['-ar', '48000'] : []),
      ...audioEncoderFor(container),
      ...containerFlags(container),
      ctx.output,
    ];
  },
});
