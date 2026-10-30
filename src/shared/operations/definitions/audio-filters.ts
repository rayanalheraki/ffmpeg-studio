import { defineOperation } from '../types';
import { audioEncoderFor, containerFlags } from '../helpers/encoders';
import { audioContainer, primaryFile } from '../helpers/streams';
import { t } from '../../i18n';

type Options = {
  noiseReduction: string;
  equalizer: string;
  rumble: boolean;
};

const NOISE_REDUCTION: Record<string, string> = {
  light: 'afftdn=nr=6:nf=-40',
  medium: 'afftdn=nr=12:nf=-30',
  strong: 'afftdn=nr=20:nf=-25',
};

const EQUALIZER_PRESETS: Record<string, string> = {
  bass: 'bass=g=6:f=110',
  treble: 'treble=g=5:f=6000',
  voice: 'equalizer=f=250:t=q:w=1:g=-3,equalizer=f=3000:t=q:w=1:g=4',
  warm: 'bass=g=3:f=200,treble=g=-2:f=8000',
  bright: 'treble=g=4:f=4000,equalizer=f=500:t=q:w=1:g=-2',
};

export function audioFilterChain(o: Options): string[] {
  return [
    ...(o.rumble ? ['highpass=f=80'] : []),
    ...(NOISE_REDUCTION[o.noiseReduction] ? [NOISE_REDUCTION[o.noiseReduction]] : []),
    ...(EQUALIZER_PRESETS[o.equalizer] ? [EQUALIZER_PRESETS[o.equalizer]] : []),
  ];
}

export default defineOperation<Options>({
  id: 'audio-filters',
  label: 'Audio filters',
  description: 'Reduce background noise and shape the sound with equalizer presets.',
  category: 'audio',
  icon: 'SlidersHorizontal',
  order: 4,
  batch: 'perFile',
  input: { accept: ['video', 'audio'] },
  outputSuffix: 'enhanced',
  options: [
    {
      key: 'noiseReduction',
      type: 'segmented',
      label: 'Noise reduction',
      default: 'medium',
      choices: [
        { value: 'off', label: 'Off' },
        { value: 'light', label: 'Light' },
        { value: 'medium', label: 'Medium' },
        { value: 'strong', label: 'Strong' },
      ],
    },
    {
      key: 'equalizer',
      type: 'select',
      label: 'Equalizer preset',
      default: 'flat',
      choices: [
        { value: 'flat', label: 'Flat', hint: 'No tone changes' },
        { value: 'voice', label: 'Voice clarity', hint: 'Clearer speech, less mud' },
        { value: 'bass', label: 'Bass boost' },
        { value: 'treble', label: 'Treble boost' },
        { value: 'warm', label: 'Warm' },
        { value: 'bright', label: 'Bright' },
      ],
    },
    {
      key: 'rumble',
      type: 'toggle',
      label: 'Remove low rumble',
      description: 'Cut frequencies below 80 Hz (wind, hum, handling noise).',
      default: false,
    },
  ],
  outputExtension: (_o, file) => audioContainer(file),
  validate: (o, inputs) => {
    if (!primaryFile(inputs).hasAudio) return t('This file has no audio track.');
    return audioFilterChain(o).length === 0 ? t('Turn on at least one filter.') : null;
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
      audioFilterChain(o).join(','),
      ...audioEncoderFor(container),
      ...containerFlags(container),
      ctx.output,
    ];
  },
});
