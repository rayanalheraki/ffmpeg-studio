import { defineOperation } from '../types';
import { primaryFile } from '../helpers/streams';

type Options = Record<string, never>;

/** FFprobe arguments used by the media info viewer. */
export function probeArgs(filePath: string): string[] {
  return ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '-show_chapters', filePath];
}

export default defineOperation<Options>({
  id: 'media-info',
  label: 'Media info',
  description: 'Inspect formats, streams, codecs and tags of any media file.',
  category: 'tools',
  icon: 'Info',
  order: 1,
  mode: 'inspect',
  batch: 'perFile',
  input: { accept: ['video', 'audio', 'image', 'subtitle'] },
  outputSuffix: 'info',
  options: [],
  outputExtension: () => 'json',
  /** Inspect operations run FFprobe; the output path is unused. */
  buildArgs: (_o, inputs) => probeArgs(primaryFile(inputs).path),
});
