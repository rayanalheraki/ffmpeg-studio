import type { Settings } from './types/settings';
import { DEFAULT_LOCALE } from './i18n';
import { DEFAULT_NAMING_PATTERN } from './jobs/output';
import { DEFAULT_OPERATION_ID } from './operations/registry';

export const APP_NAME = 'FFmpeg Studio';

export const MIN_CONCURRENCY = 1;
export const MAX_CONCURRENCY = 8;
export const DEFAULT_CONCURRENCY = 2;

/** Maximum size of the stderr log kept per job, in characters. */
export const MAX_LOG_LENGTH = 512 * 1024;

export const MAX_PRESETS_PER_OPERATION = 50;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: DEFAULT_LOCALE,
  concurrency: DEFAULT_CONCURRENCY,
  output: { directory: null, pattern: DEFAULT_NAMING_PATTERN, overwrite: 'rename' },
  lastOutputDirectory: null,
  lastOperationId: DEFAULT_OPERATION_ID,
  lastOptions: {},
  presets: [],
  sidebarCollapsed: false,
  queueOpen: true,
  notifyOnFinish: true,
};
