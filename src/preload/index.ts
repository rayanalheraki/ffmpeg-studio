import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import { IPC, type IpcResult, type StudioApi, type Unsubscribe } from '@shared/ipc';
import type { JobEvent } from '@shared/types/jobs';

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>;
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function subscribe<T>(channel: string, callback: (payload: T) => void): Unsubscribe {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

/**
 * The complete, typed surface available to the renderer. Nothing else from
 * Electron or Node.js is exposed.
 */
const api: StudioApi = {
  window: {
    minimize: () => ipcRenderer.send(IPC.windowMinimize),
    toggleMaximize: () => ipcRenderer.send(IPC.windowToggleMaximize),
    close: () => ipcRenderer.send(IPC.windowClose),
    isMaximized: () => invoke(IPC.windowIsMaximized),
    onMaximizedChange: (callback) => subscribe<boolean>(IPC.windowMaximizedChanged, callback),
  },
  dialog: {
    openFiles: (request) => invoke(IPC.dialogOpenFiles, request),
    selectFolder: (defaultPath) => invoke(IPC.dialogSelectFolder, defaultPath ?? null),
  },
  files: {
    pathForFile: (file) => webUtils.getPathForFile(file),
    showInFolder: (filePath) => invoke(IPC.shellShowInFolder, filePath),
    openPath: (filePath) => invoke(IPC.shellOpenPath, filePath),
  },
  media: {
    probe: (paths) => invoke(IPC.mediaProbe, paths),
    thumbnail: (filePath) => invoke(IPC.mediaThumbnail, filePath),
    details: (filePath) => invoke(IPC.mediaDetails, filePath),
  },
  jobs: {
    start: (request) => invoke(IPC.jobsStart, request),
    list: () => invoke(IPC.jobsList),
    cancel: (id) => invoke(IPC.jobsCancel, id),
    cancelAll: () => invoke(IPC.jobsCancelAll),
    retry: (id) => invoke(IPC.jobsRetry, id),
    remove: (id) => invoke(IPC.jobsRemove, id),
    clearFinished: () => invoke(IPC.jobsClearFinished),
    getLog: (id) => invoke(IPC.jobsGetLog, id),
    onEvent: (callback) => subscribe<JobEvent>(IPC.jobsEvent, callback),
  },
  settings: {
    get: () => invoke(IPC.settingsGet),
    update: (patch) => invoke(IPC.settingsUpdate, patch),
  },
  presets: {
    save: (operationId, name, options) => invoke(IPC.presetsSave, operationId, name, options),
    delete: (id) => invoke(IPC.presetsDelete, id),
  },
  app: {
    environment: () => invoke(IPC.appEnvironment),
    onSystemThemeChange: (callback) => subscribe<boolean>(IPC.themeSystemChanged, callback),
  },
};

contextBridge.exposeInMainWorld('studio', api);
