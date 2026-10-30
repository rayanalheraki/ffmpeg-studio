import type { MediaKind } from '../types/media';

export const EXTENSIONS: Record<Exclude<MediaKind, 'unknown'>, readonly string[]> = {
  video: ['mp4', 'm4v', 'mkv', 'webm', 'mov', 'avi', 'wmv', 'flv', 'mpg', 'mpeg', 'ts', 'mts', 'm2ts', '3gp', 'ogv', 'gif'],
  audio: ['mp3', 'aac', 'm4a', 'wav', 'flac', 'ogg', 'oga', 'opus', 'wma', 'aiff', 'aif', 'alac', 'mka'],
  image: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tif', 'tiff'],
  subtitle: ['srt', 'ass', 'ssa', 'vtt'],
};

export function extensionOf(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

export function kindFromExtension(ext: string): MediaKind {
  const normalized = ext.toLowerCase();
  for (const [kind, list] of Object.entries(EXTENSIONS) as [Exclude<MediaKind, 'unknown'>, readonly string[]][]) {
    if (list.includes(normalized)) return kind;
  }
  return 'unknown';
}

/** Extensions accepted by a set of media kinds, for file pickers. */
export function extensionsFor(kinds: readonly MediaKind[]): string[] {
  return kinds.flatMap((kind) => (kind === 'unknown' ? [] : [...EXTENSIONS[kind]]));
}

export const KIND_LABELS: Record<MediaKind, string> = {
  video: 'Video',
  audio: 'Audio',
  image: 'Image',
  subtitle: 'Subtitle',
  unknown: 'File',
};
