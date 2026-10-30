import { defineOperation } from '../types';
import { AUDIO_BITRATE_CHOICES, audioEncoderFor, containerFlags } from '../helpers/encoders';
import { primaryFile } from '../helpers/streams';

type Options = {
  format: string;
  bitrate: string;
};

const FORMAT_EXTENSIONS: Record<string, string> = { mp3: 'mp3', aac: 'm4a', wav: 'wav', flac: 'flac', ogg: 'ogg' };

/** Extension that can hold an audio codec as-is when copying. */
const COPY_EXTENSIONS: Record<string, string> = {
  aac: 'm4a',
  alac: 'm4a',
  mp3: 'mp3',
  opus: 'opus',
  vorbis: 'ogg',
  flac: 'flac',
  ac3: 'ac3',
  eac3: 'eac3',
  pcm_s16le: 'wav',
  pcm_s24le: 'wav',
};

export function copyExtension(codec: string | null): string {
  return (codec && COPY_EXTENSIONS[codec]) || 'mka';
}

export default defineOperation<Options>({
  id: 'extract-audio',
  label: 'Extract audio',
  description: 'Save the audio track of videos as a separate audio file.',
  category: 'audio',
  icon: 'AudioLines',
  order: 1,
  batch: 'perFile',
  input: { accept: ['video', 'audio'] },
  outputSuffix: 'audio',
  options: [
    {
      key: 'format',
      type: 'segmented',
      label: 'Format',
      default: 'mp3',
      choices: [
        { value: 'original', label: 'Original', hint: 'Copy without re-encoding (fastest, lossless)' },
        { value: 'mp3', label: 'MP3' },
        { value: 'aac', label: 'AAC' },
        { value: 'wav', label: 'WAV' },
        { value: 'flac', label: 'FLAC' },
        { value: 'ogg', label: 'OGG' },
      ],
    },
    {
      key: 'bitrate',
      type: 'select',
      label: 'Bitrate',
      default: '192k',
      choices: AUDIO_BITRATE_CHOICES,
      visibleWhen: (o) => ['mp3', 'aac', 'ogg'].includes(o.format),
    },
  ],
  outputExtension: (o, file) => (o.format === 'original' ? copyExtension(file.audioCodec) : (FORMAT_EXTENSIONS[o.format] ?? 'mp3')),
  validate: (_o, inputs) => (primaryFile(inputs).hasAudio ? null : 'This file has no audio track.'),
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    const args = ['-i', file.path, '-vn', '-sn', '-map', '0:a:0'];
    if (o.format === 'original') return [...args, '-c:a', 'copy', ctx.output];
    const ext = FORMAT_EXTENSIONS[o.format] ?? 'mp3';
    return [...args, ...audioEncoderFor(ext, o.bitrate), ...containerFlags(ext), ctx.output];
  },
});
