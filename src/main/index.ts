import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { BrowserWindow, Notification, app, nativeTheme, session } from 'electron';
import { APP_NAME } from '@shared/constants';
import { setLocale, t, tp } from '@shared/i18n';
import { IPC } from '@shared/ipc';
import type { JobEvent } from '@shared/types/jobs';
import type { AppEnvironment } from '@shared/types/settings';
import { getBinaries } from './ffmpeg/binaries';
import { capture } from './ffmpeg/capture';
import { registerJobsIpc } from './ipc/register-jobs';
import { registerMediaIpc } from './ipc/register-media';
import { registerSystemIpc } from './ipc/register-system';
import { createLogger } from './log';
import { probeFile } from './media/probe';
import { JobQueue, type BatchSummary } from './queue/job-queue';
import { SettingsStore } from './settings/settings-store';
import { findSystemFont } from './utils/fonts';
import { createMainWindow } from './window';

const log = createLogger('app');
let mainWindow: BrowserWindow | null = null;
let ffmpegVersion: string | null = null;

function send(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function platformName(): AppEnvironment['platform'] {
  return process.platform === 'win32' || process.platform === 'darwin' || process.platform === 'linux' ? process.platform : 'other';
}

async function detectFfmpegVersion(): Promise<void> {
  try {
    const result = await capture(getBinaries().ffmpeg, ['-hide_banner', '-version'], { timeoutMs: 10_000, maxStdoutBytes: 1024 * 1024 });
    ffmpegVersion = /ffmpeg version (\S+)/.exec(result.stdout.toString('utf8'))?.[1] ?? null;
    log.info(`Using FFmpeg ${ffmpegVersion ?? 'unknown version'}`);
  } catch (error) {
    log.error('FFmpeg is not available', error);
  }
}

function notifyBatch(summary: BatchSummary, enabled: boolean): void {
  const total = summary.completed + summary.failed + summary.cancelled;
  if (!enabled || total === 0 || !Notification.isSupported()) return;
  const parts = [tp(summary.completed, '{count} completed', '{count} completed')];
  if (summary.failed > 0) parts.push(tp(summary.failed, '{count} failed', '{count} failed'));
  if (summary.cancelled > 0) parts.push(tp(summary.cancelled, '{count} cancelled or skipped', '{count} cancelled or skipped'));
  new Notification({
    title: summary.failed > 0 ? t('Batch finished with errors') : t('All jobs finished'),
    body: parts.join(' · '),
    silent: false,
  }).show();
}

function hardenSessions(): void {
  // The renderer never needs camera, microphone, geolocation or similar permissions.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
}

function bootstrap(): void {
  const settings = new SettingsStore();
  setLocale(settings.get().language);
  const queue = new JobQueue(
    {
      emit: (event: JobEvent) => send(IPC.jobsEvent, event),
      onBatchFinished: (summary) => notifyBatch(summary, settings.get().notifyOnFinish),
      resolveBinary: () => getBinaries().ffmpeg,
      describeOutput: async (filePath) => {
        if (!existsSync(filePath)) return null;
        const file = await probeFile(filePath);
        return { fileName: file.fileName, size: file.size, ext: file.ext, width: file.width, height: file.height };
      },
    },
    settings.get().concurrency,
  );

  registerSystemIpc({
    getWindow: () => mainWindow,
    environment: () => ({ platform: platformName(), version: app.getVersion(), ffmpegVersion, fontFile: findSystemFont() }),
    isOpenable: (filePath) => queue.list().some((job) => job.outputPath === filePath || dirname(job.outputPath) === filePath),
  });
  registerMediaIpc();
  registerJobsIpc({ queue, settings });

  nativeTheme.on('updated', () => send(IPC.themeSystemChanged, nativeTheme.shouldUseDarkColors));
  app.on('before-quit', () => queue.shutdown());

  openWindow();
  void detectFfmpegVersion();
}

function openWindow(): void {
  const win = createMainWindow();
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  mainWindow = win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setName(APP_NAME);
  if (process.platform === 'win32') app.setAppUserModelId('com.ffmpegstudio.app');

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });

  void app.whenReady().then(() => {
    hardenSessions();
    bootstrap();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) openWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
