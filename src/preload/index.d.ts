import type { StudioApi } from '../shared/ipc';

declare global {
  interface Window {
    /** Typed bridge to the main process, exposed by the preload script. */
    studio: StudioApi;
  }
}

export {};
