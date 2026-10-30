import { useEffect, useState } from 'react';
import { studio } from '../lib/api';

/** Shared across components so a file's thumbnail is generated only once. */
const cache = new Map<string, Promise<string | null>>();

function load(path: string): Promise<string | null> {
  let pending = cache.get(path);
  if (!pending) {
    pending = studio.media.thumbnail(path).catch((error: unknown) => {
      console.warn(`Thumbnail failed for ${path}`, error);
      return null;
    });
    cache.set(path, pending);
  }
  return pending;
}

export type ThumbnailState = { status: 'loading' } | { status: 'ready'; src: string } | { status: 'none' };

export function useThumbnail(path: string | null): ThumbnailState {
  const [state, setState] = useState<{ path: string | null; value: ThumbnailState }>({ path, value: { status: 'loading' } });
  if (state.path !== path) setState({ path, value: { status: 'loading' } });

  useEffect(() => {
    if (!path) return;
    let active = true;
    void load(path).then((src) => {
      if (active) setState({ path, value: src ? { status: 'ready', src } : { status: 'none' } });
    });
    return () => {
      active = false;
    };
  }, [path]);

  return path ? state.value : { status: 'none' };
}
