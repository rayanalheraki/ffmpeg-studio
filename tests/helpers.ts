import { getOperation } from '@shared/operations/registry';
import { getDefaultOptions } from '@shared/operations/schema';
import type { AnyOperation, JobInputs, OptionValues } from '@shared/operations/types';
import type { MediaFile } from '@shared/types/media';

export const OUTPUT = '/out/result.ext';

export function video(overrides: Partial<MediaFile> = {}): MediaFile {
  return {
    id: 'v1',
    path: '/media/clip.mp4',
    name: 'clip',
    fileName: 'clip.mp4',
    ext: 'mp4',
    size: 10_000_000,
    kind: 'video',
    duration: 60,
    width: 1920,
    height: 1080,
    fps: 30,
    videoCodec: 'h264',
    audioCodec: 'aac',
    hasVideo: true,
    hasAudio: true,
    subtitleStreams: 0,
    bitRate: 5_000_000,
    formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
    probeError: null,
    ...overrides,
  };
}

export function audio(overrides: Partial<MediaFile> = {}): MediaFile {
  return video({
    id: 'a1',
    path: '/media/song.mp3',
    name: 'song',
    fileName: 'song.mp3',
    ext: 'mp3',
    kind: 'audio',
    duration: 180,
    width: null,
    height: null,
    fps: null,
    videoCodec: null,
    audioCodec: 'mp3',
    hasVideo: false,
    formatName: 'mp3',
    ...overrides,
  });
}

export function image(overrides: Partial<MediaFile> = {}): MediaFile {
  return video({
    id: 'i1',
    path: '/media/photo.png',
    name: 'photo',
    fileName: 'photo.png',
    ext: 'png',
    kind: 'image',
    duration: null,
    width: 800,
    height: 600,
    fps: null,
    videoCodec: 'png',
    audioCodec: null,
    hasVideo: false,
    hasAudio: false,
    formatName: 'png_pipe',
    ...overrides,
  });
}

export function subtitle(overrides: Partial<MediaFile> = {}): MediaFile {
  return video({
    id: 's1',
    path: '/media/clip.en.srt',
    name: 'clip.en',
    fileName: 'clip.en.srt',
    ext: 'srt',
    kind: 'subtitle',
    duration: null,
    width: null,
    height: null,
    fps: null,
    videoCodec: null,
    audioCodec: null,
    hasVideo: false,
    hasAudio: false,
    subtitleStreams: 1,
    ...overrides,
  });
}

export function op(id: string): AnyOperation {
  const operation = getOperation(id);
  if (!operation) throw new Error(`Operation ${id} is not registered`);
  return operation;
}

export function inputs(main: MediaFile[], extra: Record<string, MediaFile[]> = {}): JobInputs {
  return { main, extra };
}

/** Builds args for an operation using its defaults merged with overrides. */
export function build(id: string, overrides: OptionValues, jobInputs: JobInputs, fontFile: string | null = null): string[] {
  const operation = op(id);
  return operation.buildArgs({ ...getDefaultOptions(operation), ...overrides }, jobInputs, { output: OUTPUT, fontFile });
}

export function options(id: string, overrides: OptionValues = {}): OptionValues {
  return { ...getDefaultOptions(op(id)), ...overrides };
}

/** Value that follows a flag, e.g. `after(args, '-crf')`. */
export function after(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}
