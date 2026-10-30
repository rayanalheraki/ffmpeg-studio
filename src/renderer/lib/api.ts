import { t } from '@shared/i18n';
import type { StudioApi } from '@shared/ipc';

/** Typed bridge to the main process, exposed by the preload script. */
export const studio: StudioApi = window.studio;

/** Extracts a user-facing message from anything thrown by the bridge. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return t('Something went wrong.');
}

export const isMac = navigator.userAgent.includes('Mac OS');

/** Label for the platform's primary modifier key. */
export const MOD_KEY = isMac ? '⌘' : 'Ctrl';
