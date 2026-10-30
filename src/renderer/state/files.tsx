import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { errorMessage, studio } from '../lib/api';
import { MAIN_SLOT, filesReducer, type FilesState } from './files-reducer';
import { useToasts } from './toasts';
import { t, tp } from '@shared/i18n';

interface FilesApi {
  slots: FilesState;
  /** Adds files to a slot and probes them. `replace` swaps out single-file slots. */
  addPaths(slot: string, paths: string[], replace?: boolean): void;
  remove(slot: string, key: string): void;
  move(slot: string, from: number, to: number): void;
  clear(slot: string): void;
}

const FilesContext = createContext<FilesApi | null>(null);

export function FilesProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { show } = useToasts();
  const [slots, dispatch] = useReducer(filesReducer, { [MAIN_SLOT]: [] });

  const addPaths = useCallback(
    (slot: string, paths: string[], replace = false) => {
      if (paths.length === 0) return;
      dispatch({ type: 'add', slot, paths, replace });
      studio.media
        .probe(paths)
        .then((files) => {
          dispatch({ type: 'resolve', slot, files });
          const unreadable = files.filter((file) => file.probeError);
          if (unreadable.length > 0) {
            show(
              'warning',
              tp(unreadable.length, '{count} file could not be read', '{count} files could not be read'),
              unreadable.map((f) => f.fileName).join(', '),
            );
          }
        })
        .catch((error: unknown) => {
          dispatch({ type: 'drop', slot, paths });
          show('error', t('Files could not be added'), errorMessage(error));
        });
    },
    [show],
  );

  const remove = useCallback((slot: string, key: string) => dispatch({ type: 'remove', slot, key }), []);
  const move = useCallback((slot: string, from: number, to: number) => dispatch({ type: 'move', slot, from, to }), []);
  const clear = useCallback((slot: string) => dispatch({ type: 'clear', slot }), []);

  const value = useMemo(() => ({ slots, addPaths, remove, move, clear }), [slots, addPaths, remove, move, clear]);
  return <FilesContext.Provider value={value}>{children}</FilesContext.Provider>;
}

export function useFiles(): FilesApi {
  const context = useContext(FilesContext);
  if (!context) throw new Error('useFiles must be used inside <FilesProvider>.');
  return context;
}
