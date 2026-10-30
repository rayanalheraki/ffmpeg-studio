import type { MediaFile } from '@shared/types/media';

/** A file in a slot. `file` is null while FFprobe is still reading it. */
export interface FileEntry {
  key: string;
  path: string;
  file: MediaFile | null;
}

export type FilesState = Record<string, FileEntry[]>;

export const MAIN_SLOT = 'main';

export type FilesAction =
  | { type: 'add'; slot: string; paths: string[]; replace: boolean }
  | { type: 'resolve'; slot: string; files: MediaFile[] }
  | { type: 'drop'; slot: string; paths: string[] }
  | { type: 'remove'; slot: string; key: string }
  | { type: 'move'; slot: string; from: number; to: number }
  | { type: 'clear'; slot: string };

let counter = 0;
const nextKey = (): string => `f${(counter += 1)}`;

export function filesReducer(state: FilesState, action: FilesAction): FilesState {
  const list = state[action.slot] ?? [];
  switch (action.type) {
    case 'add': {
      const base = action.replace ? [] : list;
      const known = new Set(base.map((entry) => entry.path));
      const added = action.paths
        .filter((path) => !known.has(path) && known.add(path))
        .map((path) => ({ key: nextKey(), path, file: null }));
      return { ...state, [action.slot]: [...base, ...added] };
    }
    case 'resolve': {
      const byPath = new Map(action.files.map((file) => [file.path, file]));
      return { ...state, [action.slot]: list.map((entry) => ({ ...entry, file: byPath.get(entry.path) ?? entry.file })) };
    }
    case 'drop': {
      const paths = new Set(action.paths);
      return { ...state, [action.slot]: list.filter((entry) => !(entry.file == null && paths.has(entry.path))) };
    }
    case 'remove':
      return { ...state, [action.slot]: list.filter((entry) => entry.key !== action.key) };
    case 'move': {
      if (action.from === action.to || action.to < 0 || action.to >= list.length) return state;
      const next = list.slice();
      const [moved] = next.splice(action.from, 1);
      if (!moved) return state;
      next.splice(action.to, 0, moved);
      return { ...state, [action.slot]: next };
    }
    case 'clear':
      return { ...state, [action.slot]: [] };
  }
}

/** Files that finished probing, in user order. */
export function readyFiles(entries: FileEntry[] | undefined): MediaFile[] {
  return (entries ?? []).flatMap((entry) => (entry.file ? [entry.file] : []));
}
