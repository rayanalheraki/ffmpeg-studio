import { useEffect, useState } from 'react';
import type { MediaDetails } from '@shared/types/media';
import { errorMessage, studio } from '../lib/api';

export type DetailsState = { status: 'loading' } | { status: 'ready'; details: MediaDetails } | { status: 'error'; message: string };

export function useMediaDetails(path: string): DetailsState {
  const [state, setState] = useState<{ path: string; value: DetailsState }>({ path, value: { status: 'loading' } });
  if (state.path !== path) setState({ path, value: { status: 'loading' } });

  useEffect(() => {
    let active = true;
    studio.media
      .details(path)
      .then((details) => active && setState({ path, value: { status: 'ready', details } }))
      .catch((error: unknown) => active && setState({ path, value: { status: 'error', message: errorMessage(error) } }));
    return () => {
      active = false;
    };
  }, [path]);

  return state.value;
}
