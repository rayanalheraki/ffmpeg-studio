import { defineOperation } from '../types';
import { AUDIO_BITRATE_CHOICES, QUALITY_CHOICES, audioEncoderFor, containerFlags, crfFor, videoEncoderArgs } from '../helpers/encoders';
import { primaryFile } from '../helpers/streams';

type Options = {
  format: string;
  quality: string;
  audioBitrate: string;
};

const VIDEO_FORMATS = ['mp4', 'mkv', 'webm', 'mov', 'avi'];
const LOSSLESS_AUDIO = ['wav', 'flac'];
const AVI_QSCALE: Record<string, string> = { high: '2', balanced: '4', small: '7' };

/** Audio format id → file extension. AAC is written to an MP4 audio container. */
const AUDIO_EXTENSIONS: Record<string, string> = { mp3: 'mp3', aac: 'm4a', wav: 'wav', flac: 'flac', ogg: 'ogg' };

const isVideoFormat = (format: string): boolean => VIDEO_FORMATS.includes(format);

export default defineOperation<Options>({
  id: 'convert-format',
  label: 'Convert format',
  description: 'Convert videos and audio to another container and codec.',
  category: 'convert',
  icon: 'RefreshCw',
  order: 1,
  batch: 'perFile',
  input: { accept: ['video', 'audio'] },
  outputSuffix: 'converted',
  options: [
    {
      key: 'format',
      type: 'select',
      label: 'Target format',
      default: 'mp4',
      choices: [
        { value: 'mp4', label: 'MP4', hint: 'Video · H.264 + AAC' },
        { value: 'mkv', label: 'MKV', hint: 'Video · H.264 + AAC' },
        { value: 'webm', label: 'WebM', hint: 'Video · VP9 + Opus' },
        { value: 'mov', label: 'MOV', hint: 'Video · H.264 + AAC' },
        { value: 'avi', label: 'AVI', hint: 'Video · MPEG-4 + MP3' },
        { value: 'mp3', label: 'MP3', hint: 'Audio' },
        { value: 'aac', label: 'AAC', hint: 'Audio · .m4a' },
        { value: 'wav', label: 'WAV', hint: 'Audio · lossless' },
        { value: 'flac', label: 'FLAC', hint: 'Audio · lossless' },
        { value: 'ogg', label: 'OGG', hint: 'Audio · Vorbis' },
      ],
    },
    {
      key: 'quality',
      type: 'segmented',
      label: 'Video quality',
      default: 'balanced',
      choices: QUALITY_CHOICES,
      visibleWhen: (o) => isVideoFormat(o.format),
    },
    {
      key: 'audioBitrate',
      type: 'select',
      label: 'Audio bitrate',
      default: '192k',
      choices: AUDIO_BITRATE_CHOICES,
      visibleWhen: (o) => !LOSSLESS_AUDIO.includes(o.format),
    },
  ],
  outputExtension: (o) => (isVideoFormat(o.format) ? o.format : (AUDIO_EXTENSIONS[o.format] ?? 'mp3')),
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    const args = ['-i', file.path];

    if (!isVideoFormat(o.format)) {
      const ext = AUDIO_EXTENSIONS[o.format] ?? 'mp3';
      return [...args, '-vn', ...audioEncoderFor(ext, o.audioBitrate), ...containerFlags(ext), ctx.output];
    }

    if (file.hasVideo) {
      if (o.format === 'avi') args.push('-c:v', 'mpeg4', '-q:v', AVI_QSCALE[o.quality] ?? '4');
      else if (o.format === 'webm') args.push(...videoEncoderArgs('vp9', crfFor('vp9', o.quality), 'medium', 'webm'));
      else args.push(...videoEncoderArgs('h264', crfFor('h264', o.quality), 'medium', o.format));
    }
    if (file.hasAudio) args.push(...audioEncoderFor(o.format, o.audioBitrate));
    return [...args, ...containerFlags(o.format), ctx.output];
  },
});
