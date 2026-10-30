import type { JobEvent, JobSnapshot, StartBatchRequest, StartBatchResult } from './types/jobs';
import type { MediaDetails, MediaFile, MediaKind } from './types/media';
import type { AppEnvironment, Preset, Settings, SettingsPatch } from './types/settings';
import type { OptionValues } from './operations/types';

/** Every IPC channel name, shared by the main process and the preload bridge. */
export const IPC = {
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',
  windowMaximizedChanged: 'window:maximized-changed',
  dialogOpenFiles: 'dialog:open-files',
  dialogSelectFolder: 'dialog:select-folder',
  shellShowInFolder: 'shell:show-in-folder',
  shellOpenPath: 'shell:open-path',
  mediaProbe: 'media:probe',
  mediaThumbnail: 'media:thumbnail',
  mediaDetails: 'media:details',
  jobsStart: 'jobs:start',
  jobsList: 'jobs:list',
  jobsCancel: 'jobs:cancel',
  jobsCancelAll: 'jobs:cancel-all',
  jobsRetry: 'jobs:retry',
  jobsRemove: 'jobs:remove',
  jobsClearFinished: 'jobs:clear-finished',
  jobsGetLog: 'jobs:get-log',
  jobsEvent: 'jobs:event',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  presetsSave: 'presets:save',
  presetsDelete: 'presets:delete',
  appEnvironment: 'app:environment',
  themeSystemChanged: 'theme:system-changed',
} as const;

/**
 * Every `invoke` handler resolves to this envelope so user-facing error
 * messages reach the renderer unchanged (Electron rewrites thrown errors).
 */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface OpenFilesRequest {
  title?: string;
  kinds: MediaKind[];
  multiple: boolean;
}

export type Unsubscribe = () => void;

/** The API exposed to the renderer as `window.studio`. */
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
    /** Resolves the absolute path of a dropped `File`. */
    pathForFile(file: File): string;
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
