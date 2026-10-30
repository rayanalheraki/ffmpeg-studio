import { getVersion } from '@tauri-apps/api/app';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { videoDir } from '@tauri-apps/api/path';
import { type DragDropEvent, getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { t } from '@shared/i18n';
import type { FileDragEvent, OpenFilesRequest, StudioApi, Unsubscribe } from '@shared/ipc';
import { extensionsFor, KIND_LABELS } from '@shared/media/kinds';
import type { MediaKind } from '@shared/types/media';
import type { AppEnvironment } from '@shared/types/settings';
import { dirname, isAbsolute } from '@shared/utils/path';
import { host } from './host';
import { UserError } from './log';
import { detectFfmpegVersion } from './services';
import { findSystemFont } from './utils/fonts';

const KINDS: readonly MediaKind[] = ['video', 'audio', 'image', 'subtitle'];

/** Adapts Tauri's async listener registration to a synchronous unsubscribe. */
export function subscribe(start: () => Promise<UnlistenFn>): Unsubscribe {
  let stop: UnlistenFn | null = null;
  let stopped = false;
  void start().then((unlisten) => {
    if (stopped) unlisten();
    else stop = unlisten;
  });
  return () => {
    stopped = true;
    stop?.();
  };
}

function parseOpenRequest(value: unknown): OpenFilesRequest {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const kinds = Array.isArray(raw.kinds) ? raw.kinds.filter((k): k is MediaKind => KINDS.includes(k as MediaKind)) : [];
  return {
    title: typeof raw.title === 'string' ? raw.title.slice(0, 100) : t('Add files'),
    kinds: kinds.length > 0 ? kinds : [...KINDS],
    multiple: raw.multiple !== false,
  };
}

const appWindow = getCurrentWindow();

export const windowApi: StudioApi['window'] = {
  minimize: () => void appWindow.minimize(),
  toggleMaximize: () => void appWindow.toggleMaximize(),
  close: () => void appWindow.close(),
  isMaximized: () => appWindow.isMaximized(),
  onMaximizedChange: (callback) => subscribe(() => appWindow.onResized(() => void appWindow.isMaximized().then(callback))),
};

export const dialogApi: StudioApi['dialog'] = {
  openFiles: async (value) => {
    const request = parseOpenRequest(value);
    const label = request.kinds.map((kind) => t(KIND_LABELS[kind])).join(', ');
    const result = await open({
      title: request.title,
      multiple: request.multiple,
      directory: false,
      filters: [
        { name: t('{kinds} files', { kinds: label }), extensions: extensionsFor(request.kinds) },
        { name: t('All files'), extensions: ['*'] },
      ],
    });
    if (result === null) return [];
    return Array.isArray(result) ? result : [result];
  },
  selectFolder: async (defaultPath) => {
    const result = await open({
      title: t('Choose output folder'),
      directory: true,
      defaultPath: typeof defaultPath === 'string' && isAbsolute(defaultPath) ? defaultPath : await videoDir().catch(() => undefined),
    });
    return typeof result === 'string' ? result : null;
  },
};

function toDragEvent(event: DragDropEvent): FileDragEvent {
  if (event.type === 'leave') return { type: 'leave' };
  // Tauri reports physical pixels; the UI works in CSS pixels.
  const x = event.position.x / window.devicePixelRatio;
  const y = event.position.y / window.devicePixelRatio;
  return event.type === 'drop' ? { type: 'drop', x, y, paths: event.paths } : { type: 'over', x, y };
}

/**
 * Opening files is limited to job outputs and their folders, so a bug in the
 * UI can never launch arbitrary files.
 */
export function createFilesApi(isOpenable: (filePath: string) => Promise<boolean>): StudioApi['files'] {
  const checked = async (value: unknown): Promise<string> => {
    const filePath = typeof value === 'string' ? value : '';
    if (!isAbsolute(filePath) || !(await isOpenable(filePath))) throw new UserError(t('This file is not part of the job list.'));
    return filePath;
  };
  return {
    onDragDrop: (callback) => subscribe(() => getCurrentWebview().onDragDropEvent(({ payload }) => callback(toDragEvent(payload)))),
    showInFolder: async (value) => {
      const filePath = await checked(value);
      if (filePath.includes('%0') || !(await host.exists(filePath))) await host.openPath(dirname(filePath));
      else await host.revealPath(filePath);
    },
    openPath: async (value) => {
      const filePath = await checked(value);
      const target = filePath.includes('%0') ? dirname(filePath) : filePath;
      if (!(await host.exists(target))) throw new UserError(t('The file no longer exists.'));
      try {
        await host.openPath(target);
      } catch (error) {
        throw new UserError(t('The file could not be opened: {error}', { error: error instanceof Error ? error.message : String(error) }));
      }
    },
  };
}

export async function environment(): Promise<AppEnvironment> {
  const [info, version, ffmpegVersion, fontFile] = await Promise.all([host.info(), getVersion(), detectFfmpegVersion(), findSystemFont()]);
  return { platform: info.platform, version, ffmpegVersion, fontFile };
}

export function onSystemThemeChange(callback: (dark: boolean) => void): Unsubscribe {
  return subscribe(() => appWindow.onThemeChanged(({ payload }) => callback(payload === 'dark')));
}
