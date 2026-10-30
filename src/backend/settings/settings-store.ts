import { MAX_PRESETS_PER_OPERATION } from '@shared/constants';
import { t } from '@shared/i18n';
import { getOperation } from '@shared/operations/registry';
import { normalizeOptions } from '@shared/operations/schema';
import type { Preset, Settings, SettingsPatch } from '@shared/types/settings';
import { host } from '../host';
import { UserError, createLogger } from '../log';
import { sanitizePatch, sanitizeSettings } from './sanitize';

const log = createLogger('settings');

/** Persists user preferences and presets as JSON in the app's config folder. */
export class SettingsStore {
  private constructor(private current: Settings) {}

  /** Values on disk are untrusted (older versions, manual edits) and are sanitized on load. */
  static async load(): Promise<SettingsStore> {
    let stored: unknown = {};
    try {
      const contents = await host.readSettings();
      if (contents) stored = JSON.parse(contents);
    } catch (error) {
      log.warn('Settings could not be read; using defaults', error);
    }
    return new SettingsStore(sanitizeSettings(stored));
  }

  get(): Settings {
    return this.current;
  }

  async update(patch: unknown): Promise<Settings> {
    const clean: SettingsPatch = sanitizePatch(patch);
    this.current = { ...this.current, ...clean };
    await this.persist();
    return this.current;
  }

  async savePreset(operationId: unknown, name: unknown, options: unknown): Promise<Preset[]> {
    const operation = typeof operationId === 'string' ? getOperation(operationId) : undefined;
    if (!operation) throw new UserError(t('Unknown operation.'));
    const trimmed = typeof name === 'string' ? name.trim().slice(0, 80) : '';
    if (trimmed === '') throw new UserError(t('Enter a name for the preset.'));

    const others = this.current.presets.filter((p) => !(p.operationId === operation.id && p.name.toLowerCase() === trimmed.toLowerCase()));
    if (others.filter((p) => p.operationId === operation.id).length >= MAX_PRESETS_PER_OPERATION) {
      throw new UserError(t('You can save up to {count} presets per operation.', { count: MAX_PRESETS_PER_OPERATION }));
    }
    const preset: Preset = {
      id: crypto.randomUUID(),
      operationId: operation.id,
      name: trimmed,
      options: normalizeOptions(operation, options),
      createdAt: Date.now(),
    };
    this.current = { ...this.current, presets: [...others, preset] };
    await this.persist();
    return this.current.presets;
  }

  async deletePreset(id: unknown): Promise<Preset[]> {
    this.current = { ...this.current, presets: this.current.presets.filter((preset) => preset.id !== id) };
    await this.persist();
    return this.current.presets;
  }

  private async persist(): Promise<void> {
    try {
      await host.writeSettings(JSON.stringify(this.current, null, 2));
    } catch (error) {
      log.error('Failed to save settings', error);
      throw new UserError(t('Your settings could not be saved. Check that the disk is not full.'));
    }
  }
}
