import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS } from '@shared/constants';
import type { OptionValues } from '@shared/operations/types';
import type { AppEnvironment, Preset, Settings, SettingsPatch } from '@shared/types/settings';
import { errorMessage, studio } from '../lib/api';
import { useToasts } from './toasts';
import { t } from '@shared/i18n';

interface SettingsApi {
  settings: Settings;
  environment: AppEnvironment;
  loaded: boolean;
  update(patch: SettingsPatch): void;
  /** Remembers the last used options of an operation. */
  setOperationOptions(operationId: string, options: OptionValues): void;
  savePreset(operationId: string, name: string, options: OptionValues): Promise<boolean>;
  deletePreset(id: string): Promise<void>;
  presetsFor(operationId: string): Preset[];
}

const SettingsContext = createContext<SettingsApi | null>(null);
const FALLBACK_ENVIRONMENT: AppEnvironment = { platform: 'other', version: '', ffmpegVersion: null, fontFile: null };
const SAVE_DELAY_MS = 300;

export function SettingsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { show } = useToasts();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [environment, setEnvironment] = useState<AppEnvironment>(FALLBACK_ENVIRONMENT);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef<Settings>(DEFAULT_SETTINGS);
  const pending = useRef<SettingsPatch>({});
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    Promise.all([studio.settings.get(), studio.app.environment()])
      .then(([stored, env]) => {
        latest.current = stored;
        setSettings(stored);
        setEnvironment(env);
      })
      .catch((error: unknown) => show('error', t('Could not load your settings'), errorMessage(error)))
      .finally(() => setLoaded(true));
  }, [show]);

  const flush = useCallback(() => {
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    studio.settings.update(patch).catch((error: unknown) => show('error', t('Settings were not saved'), errorMessage(error)));
  }, [show]);

  // Save edits made within the debounce window before the window closes.
  useEffect(() => {
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [flush]);

  /** Applies a change immediately and saves it shortly after, batching rapid edits. */
  const update = useCallback(
    (patch: SettingsPatch) => {
      latest.current = { ...latest.current, ...patch };
      setSettings(latest.current);
      pending.current = { ...pending.current, ...patch };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  const setOperationOptions = useCallback(
    (operationId: string, options: OptionValues) => update({ lastOptions: { ...latest.current.lastOptions, [operationId]: options } }),
    [update],
  );

  const savePreset = useCallback(
    async (operationId: string, name: string, options: OptionValues) => {
      try {
        const presets = await studio.presets.save(operationId, name, options);
        latest.current = { ...latest.current, presets };
        setSettings(latest.current);
        show('success', t('Preset “{name}” saved', { name: name.trim() }));
        return true;
      } catch (error) {
        show('error', t('Preset not saved'), errorMessage(error));
        return false;
      }
    },
    [show],
  );

  const deletePreset = useCallback(
    async (id: string) => {
      try {
        const presets = await studio.presets.delete(id);
        latest.current = { ...latest.current, presets };
        setSettings(latest.current);
      } catch (error) {
        show('error', t('Preset not deleted'), errorMessage(error));
      }
    },
    [show],
  );

  const presetsFor = useCallback(
    (operationId: string) => settings.presets.filter((p) => p.operationId === operationId),
    [settings.presets],
  );

  const value = useMemo(
    () => ({ settings, environment, loaded, update, setOperationOptions, savePreset, deletePreset, presetsFor }),
    [settings, environment, loaded, update, setOperationOptions, savePreset, deletePreset, presetsFor],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside <SettingsProvider>.');
  return context;
}
