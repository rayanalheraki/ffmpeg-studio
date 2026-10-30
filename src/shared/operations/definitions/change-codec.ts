import type { MediaFile } from '../../types/media';
import { defineOperation } from '../types';
import {
  QUALITY_CHOICES,
  SPEED_CHOICES,
  type SpeedId,
  type VideoCodecId,
  audioEncoderFor,
  canCopyAudio,
  containerFlags,
  crfFor,
  videoEncoderArgs,
} from '../helpers/encoders';
import { primaryFile } from '../helpers/streams';
import { t } from '../../i18n';

type Options = {
  codec: string;
  quality: string;
  speed: string;
  container: string;
  audio: string;
};

const CODECS: VideoCodecId[] = ['h264', 'h265', 'vp9', 'av1'];
const asCodec = (value: string): VideoCodecId => ((CODECS as string[]).includes(value) ? (value as VideoCodecId) : 'h264');
const asSpeed = (value: string): SpeedId => (value === 'fast' || value === 'slow' ? value : 'medium');

function resolveContainer(o: Options, file: MediaFile): string {
  if (o.container !== 'auto') return o.container;
  const codec = asCodec(o.codec);
  if (codec === 'vp9' || codec === 'av1') return ['webm', 'mkv', 'mp4'].includes(file.ext) ? file.ext : 'webm';
  return ['mp4', 'mkv', 'mov'].includes(file.ext) ? file.ext : 'mp4';
}

export default defineOperation<Options>({
  id: 'change-codec',
  label: 'Change codec',
  description: 'Re-encode video with H.264, H.265, VP9 or AV1.',
  category: 'convert',
  icon: 'Cpu',
  order: 3,
  batch: 'perFile',
  input: { accept: ['video'] },
  outputSuffix: (o) => asCodec(o.codec),
  options: [
    {
      key: 'codec',
      type: 'segmented',
      label: 'Video codec',
      default: 'h265',
      choices: [
        { value: 'h264', label: 'H.264', hint: 'Maximum compatibility' },
        { value: 'h265', label: 'H.265', hint: 'Efficient, widely supported' },
        { value: 'vp9', label: 'VP9', hint: 'Open, great for the web' },
        { value: 'av1', label: 'AV1', hint: 'Most efficient, slowest to encode' },
      ],
    },
    { key: 'quality', type: 'segmented', label: 'Quality', default: 'balanced', choices: QUALITY_CHOICES },
    { key: 'speed', type: 'segmented', label: 'Encoding speed', default: 'medium', choices: SPEED_CHOICES },
    {
      key: 'container',
      type: 'select',
      label: 'Container',
      default: 'auto',
      span: 'half',
      choices: [
        { value: 'auto', label: 'Automatic', hint: 'Keep the source container when possible' },
        { value: 'mp4', label: 'MP4' },
        { value: 'mkv', label: 'MKV' },
        { value: 'webm', label: 'WebM' },
        { value: 'mov', label: 'MOV' },
      ],
    },
    {
      key: 'audio',
      type: 'select',
      label: 'Audio',
      default: 'auto',
      span: 'half',
      choices: [
        { value: 'auto', label: 'Copy when possible' },
        { value: 'reencode', label: 'Always re-encode' },
      ],
    },
  ],
  outputExtension: (o, file) => resolveContainer(o, file),
  validate: (o, inputs) => {
    const container = resolveContainer(o, primaryFile(inputs));
    const codec = asCodec(o.codec);
    if (container === 'webm' && (codec === 'h264' || codec === 'h265')) return t('WebM only supports the VP9 and AV1 codecs.');
    if (container === 'mov' && (codec === 'vp9' || codec === 'av1')) return t('MOV does not support VP9 or AV1. Choose MP4 or MKV.');
    return null;
  },
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    const container = resolveContainer(o, file);
    const codec = asCodec(o.codec);
    const args = ['-i', file.path, ...videoEncoderArgs(codec, crfFor(codec, o.quality), asSpeed(o.speed), container)];
    if (file.hasAudio) {
      const copy = o.audio === 'auto' && canCopyAudio(file.audioCodec, container);
      args.push(...(copy ? ['-c:a', 'copy'] : audioEncoderFor(container)));
    }
    return [...args, ...containerFlags(container), ctx.output];
  },
});
