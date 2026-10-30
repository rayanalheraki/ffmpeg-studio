import { defineOperation } from '../types';
import {
  AUDIO_BITRATE_CHOICES,
  QUALITY_CHOICES,
  SPEED_CHOICES,
  type SpeedId,
  audioEncoderFor,
  containerFlags,
  crfFor,
  videoEncoderArgs,
} from '../helpers/encoders';
import { h264Container, primaryFile } from '../helpers/streams';

type Options = {
  codec: string;
  quality: string;
  crf: number;
  speed: string;
  maxHeight: string;
  audioBitrate: string;
};

const asCodec = (value: string): 'h264' | 'h265' => (value === 'h265' ? 'h265' : 'h264');
const asSpeed = (value: string): SpeedId => (value === 'fast' || value === 'slow' ? value : 'medium');

export default defineOperation<Options>({
  id: 'compress-video',
  label: 'Compress video',
  description: 'Shrink video files with quality presets or a precise CRF value.',
  category: 'convert',
  icon: 'Minimize2',
  order: 2,
  batch: 'perFile',
  input: { accept: ['video'] },
  outputSuffix: 'compressed',
  options: [
    {
      key: 'codec',
      type: 'segmented',
      label: 'Codec',
      default: 'h264',
      choices: [
        { value: 'h264', label: 'H.264', hint: 'Plays everywhere' },
        { value: 'h265', label: 'H.265', hint: 'About 40% smaller, slower to encode' },
      ],
    },
    {
      key: 'quality',
      type: 'segmented',
      label: 'Quality',
      default: 'balanced',
      choices: [...QUALITY_CHOICES, { value: 'custom', label: 'Custom', hint: 'Choose a CRF value' }],
    },
    {
      key: 'crf',
      type: 'slider',
      label: 'CRF',
      description: 'Lower values mean higher quality and larger files.',
      min: 0,
      max: 51,
      step: 1,
      default: 23,
      visibleWhen: (o) => o.quality === 'custom',
    },
    { key: 'speed', type: 'segmented', label: 'Encoding speed', default: 'medium', choices: SPEED_CHOICES },
    {
      key: 'maxHeight',
      type: 'select',
      label: 'Maximum resolution',
      description: 'Downscale larger videos. Smaller videos are never upscaled.',
      default: 'original',
      span: 'half',
      choices: [
        { value: 'original', label: 'Keep original' },
        { value: '2160', label: '4K (2160p)' },
        { value: '1080', label: '1080p' },
        { value: '720', label: '720p' },
        { value: '480', label: '480p' },
      ],
    },
    { key: 'audioBitrate', type: 'select', label: 'Audio bitrate', default: '128k', span: 'half', choices: AUDIO_BITRATE_CHOICES },
  ],
  outputExtension: (_o, file) => h264Container(file),
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    const codec = asCodec(o.codec);
    const container = h264Container(file);
    const crf = o.quality === 'custom' ? o.crf : crfFor(codec, o.quality);
    const args = ['-i', file.path];
    if (o.maxHeight !== 'original') args.push('-vf', `scale=-2:'min(ih,${o.maxHeight})'`);
    args.push(...videoEncoderArgs(codec, crf, asSpeed(o.speed), container));
    if (file.hasAudio) args.push(...audioEncoderFor(container, o.audioBitrate));
    return [...args, ...containerFlags(container), ctx.output];
  },
});
