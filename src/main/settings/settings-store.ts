import { randomUUID } from 'node:crypto';
import Store from 'electron-store';
import { DEFAULT_SETTINGS, MAX_PRESETS_PER_OPERATION } from '@shared/constants';
import { getOperation } from '@shared/operations/registry';
import { normalizeOptions } from '@shared/operations/schema';
import type { Preset, Settings, SettingsPatch } from '@shared/types/settings';
import { UserError, createLogger } from '../log';
import { sanitizePatch, sanitizeSettings } from './sanitize';

const log = createLogger('settings');

/** Persists user preferences and presets with electron-store. */
export class SettingsStore {
  // Values on disk are untrusted (older versions, manual edits) and are sanitized on load.
  private readonly store: Store<Record<string, unknown>>;
  private current: Settings;

  constructor() {
    this.store = new Store<Record<string, unknown>>({ name: 'settings', defaults: { ...DEFAULT_SETTINGS }, clearInvalidConfig: true });
    this.current = sanitizeSettings(this.store.store);
  }

  get(): Settings {
    return this.current;
  }

  update(patch: unknown): Settings {
    const clean: SettingsPatch = sanitizePatch(patch);
    this.current = { ...this.current, ...clean };
    this.persist();
    return this.current;
  }

  savePreset(operationId: unknown, name: unknown, options: unknown): Preset[] {
    const operation = typeof operationId === 'string' ? getOperation(operationId) : undefined;
    if (!operation) throw new UserError('Unknown operation.');
    const trimmed = typeof name === 'string' ? name.trim().slice(0, 80) : '';
    if (trimmed === '') throw new UserError('Enter a name for the preset.');

    const others = this.current.presets.filter((p) => !(p.operationId === operation.id && p.name.toLowerCase() === trimmed.toLowerCase()));
    if (others.filter((p) => p.operationId === operation.id).length >= MAX_PRESETS_PER_OPERATION) {
      throw new UserError(`You can save up to ${MAX_PRESETS_PER_OPERATION} presets per operation.`);
    }
    const preset: Preset = {
      id: randomUUID(),
      operationId: operation.id,
      name: trimmed,
      options: normalizeOptions(operation, options),
      createdAt: Date.now(),
    };
    this.current = { ...this.current, presets: [...others, preset] };
    this.persist();
    return this.current.presets;
  }

  deletePreset(id: unknown): Preset[] {
    this.current = { ...this.current, presets: this.current.presets.filter((preset) => preset.id !== id) };
    this.persist();
    return this.current.presets;
  }

  private persist(): void {
    try {
      this.store.set({ ...this.current });
    } catch (error) {
      log.error('Failed to save settings', error);
      throw new UserError('Your settings could not be saved. Check that the disk is not full.');
    }
  }
}
