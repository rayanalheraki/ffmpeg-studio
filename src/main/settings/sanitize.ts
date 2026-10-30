import { isAbsolute } from 'node:path';
import { DEFAULT_SETTINGS, MAX_CONCURRENCY, MIN_CONCURRENCY } from '@shared/constants';
import { isLocale } from '@shared/i18n';
import { getOperation } from '@shared/operations/registry';
import { normalizeOptions } from '@shared/operations/schema';
import type { OptionValues } from '@shared/operations/types';
import type { OutputSettings, OverwriteBehavior } from '@shared/types/jobs';
import type { Preset, Settings, SettingsPatch, ThemePreference } from '@shared/types/settings';

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];
const OVERWRITE: readonly OverwriteBehavior[] = ['overwrite', 'rename', 'skip'];

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Raw) : {});
const absoluteOrNull = (value: unknown): string | null => (typeof value === 'string' && isAbsolute(value) ? value : null);

function sanitizeOutput(value: unknown): OutputSettings {
  const raw = asRecord(value);
  return {
    directory: absoluteOrNull(raw.directory),
    pattern: typeof raw.pattern === 'string' && raw.pattern.trim() !== '' ? raw.pattern.slice(0, 200) : DEFAULT_SETTINGS.output.pattern,
    overwrite: OVERWRITE.includes(raw.overwrite as OverwriteBehavior)
      ? (raw.overwrite as OverwriteBehavior)
      : DEFAULT_SETTINGS.output.overwrite,
  };
}

function sanitizeLastOptions(value: unknown): Record<string, OptionValues> {
  const result: Record<string, OptionValues> = {};
  for (const [id, options] of Object.entries(asRecord(value))) {
    const operation = getOperation(id);
    if (operation) result[id] = normalizeOptions(operation, options);
  }
  return result;
}

function sanitizePreset(value: unknown): Preset | null {
  const raw = asRecord(value);
  const operation = typeof raw.operationId === 'string' ? getOperation(raw.operationId) : undefined;
  if (!operation || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  return {
    id: raw.id,
    operationId: operation.id,
    name: raw.name.slice(0, 80),
    options: normalizeOptions(operation, raw.options),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
  };
}

/**
 * Validates a partial settings update coming from the renderer. Unknown or
 * malformed fields are dropped rather than stored.
 */
export function sanitizePatch(value: unknown): SettingsPatch {
  const raw = asRecord(value);
  const patch: SettingsPatch = {};
  if (THEMES.includes(raw.theme as ThemePreference)) patch.theme = raw.theme as ThemePreference;
  if (isLocale(raw.language)) patch.language = raw.language;
  if (typeof raw.concurrency === 'number' && Number.isFinite(raw.concurrency)) {
    patch.concurrency = Math.min(MAX_CONCURRENCY, Math.max(MIN_CONCURRENCY, Math.round(raw.concurrency)));
  }
  if ('output' in raw) patch.output = sanitizeOutput(raw.output);
  if ('lastOutputDirectory' in raw) patch.lastOutputDirectory = absoluteOrNull(raw.lastOutputDirectory);
  if (typeof raw.lastOperationId === 'string' && getOperation(raw.lastOperationId)) patch.lastOperationId = raw.lastOperationId;
  if ('lastOptions' in raw) patch.lastOptions = sanitizeLastOptions(raw.lastOptions);
  if (typeof raw.sidebarCollapsed === 'boolean') patch.sidebarCollapsed = raw.sidebarCollapsed;
  if (typeof raw.queueOpen === 'boolean') patch.queueOpen = raw.queueOpen;
  if (typeof raw.notifyOnFinish === 'boolean') patch.notifyOnFinish = raw.notifyOnFinish;
  return patch;
}

/** Repairs settings loaded from disk (e.g. written by an older version). */
export function sanitizeSettings(value: unknown): Settings {
  const raw = asRecord(value);
  const presets = Array.isArray(raw.presets) ? raw.presets.map(sanitizePreset).filter((p): p is Preset => p !== null) : [];
  return { ...DEFAULT_SETTINGS, ...sanitizePatch(raw), presets };
}
