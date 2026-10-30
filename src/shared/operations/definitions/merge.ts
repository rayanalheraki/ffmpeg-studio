import type { MediaFile } from '../../types/media';
import { defineOperation } from '../types';
import { audioEncoderFor, containerFlags, videoEncoderArgs } from '../helpers/encoders';
import { even, round } from '../helpers/filters';
import { primaryFile } from '../helpers/streams';

type Options = {
  format: string;
  resolution: string;
};

const VIDEO_OUTPUTS = ['mp4', 'mkv', 'mov'];
const AUDIO_OUTPUTS = ['mp3', 'm4a', 'wav', 'flac'];
const RESOLUTIONS: Record<string, [number, number]> = { '1080': [1920, 1080], '720': [1280, 720] };

/** Automatic format follows the first file: its container if supported, otherwise MP4 or MP3. */
function resolveFormat(o: Options, first: MediaFile): string {
  if (o.format !== 'auto') return o.format;
  if (first.hasVideo) return VIDEO_OUTPUTS.includes(first.ext) ? first.ext : 'mp4';
  return AUDIO_OUTPUTS.includes(first.ext) ? first.ext : 'mp3';
}

const AUDIO_NORMALIZE = 'aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';

export default defineOperation<Options>({
  id: 'merge',
  label: 'Merge files',
  description: 'Join several videos or audio files into one, in the order shown.',
  category: 'edit',
  icon: 'Combine',
  order: 2,
  batch: 'combine',
  input: { accept: ['video', 'audio'], minFiles: 2, label: 'Files to merge (drag to reorder)' },
  outputSuffix: 'merged',
  options: [
    {
      key: 'format',
      type: 'select',
      label: 'Output format',
      default: 'auto',
      span: 'half',
      choices: [
        { value: 'auto', label: 'Automatic', hint: 'Based on the first file' },
        { value: 'mp4', label: 'MP4 video' },
        { value: 'mkv', label: 'MKV video' },
        { value: 'mov', label: 'MOV video' },
        { value: 'mp3', label: 'MP3 audio' },
        { value: 'm4a', label: 'AAC audio (.m4a)' },
        { value: 'wav', label: 'WAV audio' },
        { value: 'flac', label: 'FLAC audio' },
      ],
    },
    {
      key: 'resolution',
      type: 'select',
      label: 'Video size',
      description: 'Files with a different size are scaled and letterboxed to fit.',
      default: 'first',
      span: 'half',
      choices: [
        { value: 'first', label: 'Match first video' },
        { value: '1080', label: '1080p · 1920×1080' },
        { value: '720', label: '720p · 1280×720' },
      ],
    },
  ],
  outputExtension: (o, file) => resolveFormat(o, file),
  expectedDuration: (_o, inputs) => inputs.main.reduce((sum, file) => sum + (file.duration ?? 0), 0) || null,
  validate: (o, inputs) => {
    const format = resolveFormat(o, primaryFile(inputs));
    if (VIDEO_OUTPUTS.includes(format) && inputs.main.some((file) => !file.hasVideo)) {
      return 'Every file must contain video to merge into a video. Choose an audio format instead.';
    }
    const missingDuration = inputs.main.some((file) => !file.hasAudio && file.duration == null);
    if (missingDuration) return 'Could not read the duration of a file without audio.';
    return null;
  },
  buildArgs: (o, inputs, ctx) => {
    const files = inputs.main;
    const first = primaryFile(inputs);
    const format = resolveFormat(o, first);
    const withVideo = VIDEO_OUTPUTS.includes(format);
    const [width, height] =
      o.resolution !== 'first' ? (RESOLUTIONS[o.resolution] ?? [1920, 1080]) : [even(first.width ?? 1920), even(first.height ?? 1080)];
    const fps = round(first.fps ?? 30, 3);

    const args = files.flatMap((file) => ['-i', file.path]);
    const chains: string[] = [];
    const segments: string[] = [];
    let silentIndex = files.length;

    files.forEach((file, i) => {
      let segment = '';
      if (withVideo) {
        chains.push(
          `[${i}:v:0]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p[v${i}]`,
        );
        segment += `[v${i}]`;
      }
      if (file.hasAudio) {
        chains.push(`[${i}:a:0]${AUDIO_NORMALIZE}[a${i}]`);
      } else {
        args.push('-f', 'lavfi', '-t', String(file.duration ?? 0), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
        chains.push(`[${silentIndex}:a]${AUDIO_NORMALIZE}[a${i}]`);
        silentIndex += 1;
      }
      segments.push(`${segment}[a${i}]`);
    });

    const concat = `${segments.join('')}concat=n=${files.length}:v=${withVideo ? 1 : 0}:a=1${withVideo ? '[outv]' : ''}[outa]`;
    args.push('-filter_complex', `${chains.join(';')};${concat}`);
    if (withVideo) args.push('-map', '[outv]', ...videoEncoderArgs('h264', 20, 'medium', format));
    args.push('-map', '[outa]', ...audioEncoderFor(format), ...containerFlags(format));
    return [...args, ctx.output];
  },
});
