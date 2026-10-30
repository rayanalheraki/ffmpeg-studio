import type { MediaFile } from '../../types/media';
import type { JobInputs } from '../types';
import { audioEncoderFor, canCopyAudio, containerFlags, crfFor, videoEncoderArgs } from './encoders';

export function primaryFile(inputs: JobInputs): MediaFile {
  const file = inputs.main[0];
  if (!file) throw new Error('No input file was provided for this job.');
  return file;
}

export function extraFiles(inputs: JobInputs, slotId: string): MediaFile[] {
  return inputs.extra[slotId] ?? [];
}

const STANDARD_VIDEO_CONTAINERS = ['mp4', 'mkv', 'mov'];
const IMAGE_OUTPUTS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tif', 'tiff'];

/** Container used when an operation re-encodes video with H.264. */
export function h264Container(file: MediaFile): string {
  return STANDARD_VIDEO_CONTAINERS.includes(file.ext) ? file.ext : 'mp4';
}

/** Keeps the source container when it can hold arbitrary audio codecs we produce. */
export function audioContainer(file: MediaFile): string {
  if (file.kind !== 'audio') return h264Container(file);
  return ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus'].includes(file.ext) ? file.ext : 'm4a';
}

/** Audio arguments that copy when possible and re-encode otherwise. */
export function audioCopyOrEncode(file: MediaFile, container: string): string[] {
  if (!file.hasAudio) return [];
  return canCopyAudio(file.audioCodec, container) ? ['-c:a', 'copy'] : audioEncoderFor(container);
}

export function isImageOutput(file: MediaFile): boolean {
  return file.kind === 'image' && IMAGE_OUTPUTS.includes(file.ext);
}

/** Output extension for "visual" operations that accept both videos and still images. */
export function visualExtension(file: MediaFile): string {
  return isImageOutput(file) ? file.ext : h264Container(file);
}

/**
 * Encoder arguments for a re-encoded video (H.264 + compatible audio) or a
 * still image (same format, high quality).
 */
export function visualEncodeArgs(file: MediaFile, quality = 'high'): string[] {
  if (isImageOutput(file)) {
    if (file.ext === 'jpg' || file.ext === 'jpeg') return ['-q:v', '2', '-frames:v', '1', '-update', '1'];
    return ['-frames:v', '1', '-update', '1'];
  }
  const container = h264Container(file);
  return [
    ...videoEncoderArgs('h264', crfFor('h264', quality), 'medium', container),
    ...audioCopyOrEncode(file, container),
    ...containerFlags(container),
  ];
}
