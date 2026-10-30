import { existsSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import { type BrowserWindow, app, dialog, shell } from 'electron';
import { t } from '@shared/i18n';
import { IPC, type OpenFilesRequest } from '@shared/ipc';
import { extensionsFor, KIND_LABELS } from '@shared/media/kinds';
import type { MediaKind } from '@shared/types/media';
import type { AppEnvironment } from '@shared/types/settings';
import { UserError } from '../log';
import { assertString, handle, listen } from './handle';

const KINDS: readonly MediaKind[] = ['video', 'audio', 'image', 'subtitle'];

function parseOpenRequest(value: unknown): OpenFilesRequest {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const kinds = Array.isArray(raw.kinds) ? raw.kinds.filter((k): k is MediaKind => KINDS.includes(k as MediaKind)) : [];
  return {
    title: typeof raw.title === 'string' ? raw.title.slice(0, 100) : t('Add files'),
    kinds: kinds.length > 0 ? kinds : [...KINDS],
    multiple: raw.multiple !== false,
  };
}

export interface SystemDeps {
  getWindow(): BrowserWindow | null;
  environment(): AppEnvironment;
  /** Paths the renderer is allowed to open: job outputs and their folders. */
  isOpenable(filePath: string): boolean;
}

export function registerSystemIpc(deps: SystemDeps): void {
  listen(IPC.windowMinimize, () => deps.getWindow()?.minimize());
  listen(IPC.windowToggleMaximize, () => {
    const win = deps.getWindow();
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  listen(IPC.windowClose, () => deps.getWindow()?.close());
  handle(IPC.windowIsMaximized, () => deps.getWindow()?.isMaximized() ?? false);

  handle(IPC.dialogOpenFiles, async (value) => {
    const request = parseOpenRequest(value);
    const win = deps.getWindow();
    const label = request.kinds.map((kind) => t(KIND_LABELS[kind])).join(', ');
    const options: Electron.OpenDialogOptions = {
      title: request.title,
      properties: request.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: [
        { name: t('{kinds} files', { kinds: label }), extensions: extensionsFor(request.kinds) },
        { name: t('All files'), extensions: ['*'] },
      ],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled ? [] : result.filePaths;
  });

  handle(IPC.dialogSelectFolder, async (defaultPath) => {
    const win = deps.getWindow();
    const options: Electron.OpenDialogOptions = {
      title: t('Choose output folder'),
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: typeof defaultPath === 'string' && isAbsolute(defaultPath) ? defaultPath : app.getPath('videos'),
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  handle(IPC.shellShowInFolder, (value) => {
    const filePath = assertString(value, 'path');
    if (!deps.isOpenable(filePath)) throw new UserError(t('This file is not part of the job list.'));
    if (filePath.includes('%0') || !existsSync(filePath)) {
      void shell.openPath(dirname(filePath));
      return;
    }
    shell.showItemInFolder(filePath);
  });

  handle(IPC.shellOpenPath, async (value) => {
    const filePath = assertString(value, 'path');
    if (!deps.isOpenable(filePath)) throw new UserError(t('This file is not part of the job list.'));
    const target = filePath.includes('%0') ? dirname(filePath) : filePath;
    if (!existsSync(target)) throw new UserError(t('The file no longer exists.'));
    const error = await shell.openPath(target);
    if (error) throw new UserError(t('The file could not be opened: {error}', { error }));
  });

  handle(IPC.appEnvironment, () => deps.environment());
}
