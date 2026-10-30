import { createStudioApi } from '@backend/index';
import { t } from '@shared/i18n';
import type { StudioApi } from '@shared/ipc';

/** Typed access to the system: files, FFmpeg, settings and the window. */
export const studio: StudioApi = createStudioApi();

/** Extracts a user-facing message from anything thrown by the API. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return t('Something went wrong.');
}

export const isMac = navigator.userAgent.includes('Mac OS');

/** Label for the platform's primary modifier key. */
export const MOD_KEY = isMac ? '⌘' : 'Ctrl';
