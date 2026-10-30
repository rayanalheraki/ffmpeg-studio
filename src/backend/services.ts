import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { setLocale, t, tp } from '@shared/i18n';
import type { JobEvent } from '@shared/types/jobs';
import { capture } from './ffmpeg/capture';
import { createLogger } from './log';
import { probeFile } from './media/probe';
import { JobQueue, type BatchSummary } from './queue/job-queue';
import { SettingsStore } from './settings/settings-store';
import { host } from './host';

const log = createLogger('app');

export interface Services {
  settings: SettingsStore;
  queue: JobQueue;
}

const jobListeners = new Set<(event: JobEvent) => void>();

export function onJobEvent(listener: (event: JobEvent) => void): () => void {
  jobListeners.add(listener);
  return () => jobListeners.delete(listener);
}

async function notifyBatch(summary: BatchSummary, enabled: boolean): Promise<void> {
  const total = summary.completed + summary.failed + summary.cancelled;
  if (!enabled || total === 0) return;
  const granted = (await isPermissionGranted()) || (await requestPermission()) === 'granted';
  if (!granted) return;
  const parts = [tp(summary.completed, '{count} completed', '{count} completed')];
  if (summary.failed > 0) parts.push(tp(summary.failed, '{count} failed', '{count} failed'));
  if (summary.cancelled > 0) parts.push(tp(summary.cancelled, '{count} cancelled or skipped', '{count} cancelled or skipped'));
  sendNotification({
    title: summary.failed > 0 ? t('Batch finished with errors') : t('All jobs finished'),
    body: parts.join(' · '),
  });
}

async function bootstrap(): Promise<Services> {
  const settings = await SettingsStore.load();
  setLocale(settings.get().language);
  const queue = new JobQueue(
    {
      emit: (event) => {
        for (const listener of jobListeners) listener(event);
      },
      onBatchFinished: (summary) => {
        notifyBatch(summary, settings.get().notifyOnFinish).catch((error: unknown) => log.warn('Notification failed', error));
      },
      describeOutput: async (filePath) => {
        if (!(await host.exists(filePath))) return null;
        const file = await probeFile(filePath);
        return { fileName: file.fileName, size: file.size, ext: file.ext, width: file.width, height: file.height };
      },
    },
    settings.get().concurrency,
  );
  return { settings, queue };
}

let services: Promise<Services> | undefined;

/** The settings store and job queue, created on first use. */
export function getServices(): Promise<Services> {
  services ??= bootstrap();
  return services;
}

let ffmpegVersion: Promise<string | null> | undefined;

export function detectFfmpegVersion(): Promise<string | null> {
  ffmpegVersion ??= capture('ffmpeg', ['-hide_banner', '-version'], { timeoutMs: 10_000, maxStdoutBytes: 1024 * 1024 }).then(
    (result) => {
      const version = /ffmpeg version (\S+)/.exec(result.stdout)?.[1] ?? null;
      log.info(`Using FFmpeg ${version ?? 'unknown version'}`);
      return version;
    },
    (error: unknown) => {
      log.error('FFmpeg is not available', error);
      return null;
    },
  );
  return ffmpegVersion;
}
