import type { JobEvent, JobSnapshot, StartBatchRequest, StartBatchResult } from './types/jobs';
import type { MediaDetails, MediaFile, MediaKind } from './types/media';
import type { AppEnvironment, Preset, Settings, SettingsPatch } from './types/settings';
import type { OptionValues } from './operations/types';

export interface OpenFilesRequest {
  title?: string;
  kinds: MediaKind[];
  multiple: boolean;
}

/** Files dragged from the OS over the window. Coordinates are CSS pixels in the viewport. */
export type FileDragEvent =
  { type: 'over'; x: number; y: number } | { type: 'drop'; x: number; y: number; paths: string[] } | { type: 'leave' };

export type Unsubscribe = () => void;

/**
 * Everything the UI may ask of the system. Implemented by `src/backend`, which
 * is the only code that talks to Tauri and the Rust side.
 */
export interface StudioApi {
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
    isMaximized(): Promise<boolean>;
    onMaximizedChange(callback: (maximized: boolean) => void): Unsubscribe;
  };
  dialog: {
    openFiles(request: OpenFilesRequest): Promise<string[]>;
    selectFolder(defaultPath?: string | null): Promise<string | null>;
  };
  files: {
    /** OS file drags; the webview does not expose paths on HTML5 drop events. */
    onDragDrop(callback: (event: FileDragEvent) => void): Unsubscribe;
    showInFolder(filePath: string): Promise<void>;
    openPath(filePath: string): Promise<void>;
  };
  media: {
    probe(paths: string[]): Promise<MediaFile[]>;
    thumbnail(filePath: string): Promise<string | null>;
    details(filePath: string): Promise<MediaDetails>;
  };
  jobs: {
    start(request: StartBatchRequest): Promise<StartBatchResult>;
    list(): Promise<JobSnapshot[]>;
    cancel(id: string): Promise<void>;
    cancelAll(): Promise<void>;
    retry(id: string): Promise<void>;
    remove(id: string): Promise<void>;
    clearFinished(): Promise<void>;
    getLog(id: string): Promise<string>;
    onEvent(callback: (event: JobEvent) => void): Unsubscribe;
  };
  settings: {
    get(): Promise<Settings>;
    update(patch: SettingsPatch): Promise<Settings>;
  };
  presets: {
    save(operationId: string, name: string, options: OptionValues): Promise<Preset[]>;
    delete(id: string): Promise<Preset[]>;
  };
  app: {
    environment(): Promise<AppEnvironment>;
    onSystemThemeChange(callback: (dark: boolean) => void): Unsubscribe;
  };
}
