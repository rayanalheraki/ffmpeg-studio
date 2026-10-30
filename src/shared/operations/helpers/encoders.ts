import type { Choice } from '../types';

export type VideoCodecId = 'h264' | 'h265' | 'vp9' | 'av1';
export type QualityId = 'high' | 'balanced' | 'small';
export type SpeedId = 'fast' | 'medium' | 'slow';

interface VideoCodecSpec {
  label: string;
  encoder: string;
  crf: Record<QualityId, number>;
  maxCrf: number;
}

export const VIDEO_CODECS: Record<VideoCodecId, VideoCodecSpec> = {
  h264: { label: 'H.264', encoder: 'libx264', crf: { high: 18, balanced: 23, small: 28 }, maxCrf: 51 },
  h265: { label: 'H.265', encoder: 'libx265', crf: { high: 22, balanced: 28, small: 32 }, maxCrf: 51 },
  vp9: { label: 'VP9', encoder: 'libvpx-vp9', crf: { high: 24, balanced: 32, small: 40 }, maxCrf: 63 },
  av1: { label: 'AV1', encoder: 'libaom-av1', crf: { high: 24, balanced: 32, small: 40 }, maxCrf: 63 },
};

export const QUALITY_CHOICES: Choice[] = [
  { value: 'high', label: 'High', hint: 'Best quality, larger file' },
  { value: 'balanced', label: 'Balanced', hint: 'Good quality and size' },
  { value: 'small', label: 'Small', hint: 'Smallest file, lower quality' },
];

export const SPEED_CHOICES: Choice[] = [
  { value: 'fast', label: 'Fast', hint: 'Quicker encode, slightly larger file' },
  { value: 'medium', label: 'Medium', hint: 'Recommended' },
  { value: 'slow', label: 'Slow', hint: 'Smaller file, takes longer' },
];

export const AUDIO_BITRATE_CHOICES: Choice[] = [
  { value: '96k', label: '96 kbps' },
  { value: '128k', label: '128 kbps' },
  { value: '192k', label: '192 kbps' },
  { value: '256k', label: '256 kbps' },
  { value: '320k', label: '320 kbps' },
];

const X26X_PRESETS: Record<SpeedId, string> = { fast: 'veryfast', medium: 'medium', slow: 'slow' };
const VPX_CPU_USED: Record<SpeedId, string> = { fast: '5', medium: '2', slow: '1' };
const AOM_CPU_USED: Record<SpeedId, string> = { fast: '8', medium: '6', slow: '4' };

export function isQuality(value: string): value is QualityId {
  return value === 'high' || value === 'balanced' || value === 'small';
}

export function crfFor(codec: VideoCodecId, quality: string): number {
  return VIDEO_CODECS[codec].crf[isQuality(quality) ? quality : 'balanced'];
}

/** Video encoder arguments for a codec at a CRF and speed, tuned for broad playback compatibility. */
export function videoEncoderArgs(codec: VideoCodecId, crf: number, speed: SpeedId, container: string): string[] {
  const value = String(Math.round(crf));
  switch (codec) {
    case 'h264':
      return ['-c:v', 'libx264', '-preset', X26X_PRESETS[speed], '-crf', value, '-pix_fmt', 'yuv420p'];
    case 'h265': {
      const tag = container === 'mp4' || container === 'mov' ? ['-tag:v', 'hvc1'] : [];
      return ['-c:v', 'libx265', '-preset', X26X_PRESETS[speed], '-crf', value, '-pix_fmt', 'yuv420p', ...tag];
    }
    case 'vp9':
      return [
        '-c:v',
        'libvpx-vp9',
        '-crf',
        value,
        '-b:v',
        '0',
        '-deadline',
        'good',
        '-cpu-used',
        VPX_CPU_USED[speed],
        '-row-mt',
        '1',
        '-pix_fmt',
        'yuv420p',
      ];
    case 'av1':
      return ['-c:v', 'libaom-av1', '-crf', value, '-b:v', '0', '-cpu-used', AOM_CPU_USED[speed], '-row-mt', '1', '-pix_fmt', 'yuv420p'];
  }
}

/** Audio encoder that fits a container, used whenever audio must be re-encoded. */
export function audioEncoderFor(container: string, bitrate = '192k'): string[] {
  switch (container) {
    case 'webm':
    case 'opus':
      return ['-c:a', 'libopus', '-b:a', bitrate];
    case 'ogg':
    case 'oga':
      return ['-c:a', 'libvorbis', '-b:a', bitrate];
    case 'mp3':
    case 'avi':
      return ['-c:a', 'libmp3lame', '-b:a', bitrate];
    case 'wav':
      return ['-c:a', 'pcm_s16le'];
    case 'flac':
      return ['-c:a', 'flac'];
    default:
      return ['-c:a', 'aac', '-b:a', bitrate];
  }
}

/** Container-level flags that improve playback of the produced file. */
export function containerFlags(container: string): string[] {
  return container === 'mp4' || container === 'mov' || container === 'm4a' ? ['-movflags', '+faststart'] : [];
}

const AUDIO_CODECS_BY_CONTAINER: Record<string, readonly string[]> = {
  mp4: ['aac', 'mp3', 'ac3', 'eac3', 'alac', 'opus', 'flac'],
  mov: ['aac', 'mp3', 'ac3', 'eac3', 'alac', 'pcm_s16le', 'pcm_s24le'],
  webm: ['opus', 'vorbis'],
  avi: ['mp3', 'ac3', 'pcm_s16le'],
};

/** Whether an audio stream can be copied into a container without re-encoding. */
export function canCopyAudio(audioCodec: string | null, container: string): boolean {
  if (audioCodec == null) return false;
  if (container === 'mkv') return true;
  return AUDIO_CODECS_BY_CONTAINER[container]?.includes(audioCodec) ?? false;
}
