import type { OptionValues } from '../operations/types';
import type { OutputSettings } from './jobs';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Preset {
  id: string;
  operationId: string;
  name: string;
  options: OptionValues;
  createdAt: number;
}

export interface Settings {
  theme: ThemePreference;
  concurrency: number;
  output: OutputSettings;
  /** Last folder chosen in the output folder picker. */
  lastOutputDirectory: string | null;
  lastOperationId: string;
  lastOptions: Record<string, OptionValues>;
  presets: Preset[];
  sidebarCollapsed: boolean;
  queueOpen: boolean;
  notifyOnFinish: boolean;
}

/** Fields the renderer may change through `settings.update`. */
export type SettingsPatch = Partial<Omit<Settings, 'presets'>>;

export interface AppEnvironment {
  platform: 'win32' | 'darwin' | 'linux' | 'other';
  version: string;
  ffmpegVersion: string | null;
  /** System font used by text-drawing filters, or null if none was found. */
  fontFile: string | null;
}
