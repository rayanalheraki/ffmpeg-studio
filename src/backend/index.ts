import { setLocale, t } from '@shared/i18n';
import type { StudioApi } from '@shared/ipc';
import type { StartBatchResult } from '@shared/types/jobs';
import { dirname, isAbsolute } from '@shared/utils/path';
import { UserError, createLogger } from './log';
import { mediaDetails, probeFiles } from './media/probe';
import { createThumbnail } from './media/thumbnail';
import { createJobs } from './queue/create-jobs';
import { getServices, onJobEvent } from './services';
import { createFilesApi, dialogApi, environment, onSystemThemeChange, windowApi } from './system';
import { findSystemFont } from './utils/fonts';

const log = createLogger('api');

/**
 * Runs an API call and keeps the old IPC contract: user-facing errors pass
 * through unchanged, anything unexpected is logged and replaced with a generic message.
 */
async function guard<T>(name: string, task: () => T | Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof UserError) throw error;
    log.error(`${name} failed`, error);
    throw new Error(t('Something went wrong. Details were written to the application log.'), { cause: error });
  }
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value === '') throw new UserError(t('Invalid {name}.', { name: label }));
  return value;
}

function absolutePath(value: unknown): string {
  const filePath = assertString(value, 'file path');
  if (!isAbsolute(filePath)) throw new UserError(t('File paths must be absolute.'));
  return filePath;
}

/** Job outputs and their folders are the only paths the UI may open. */
async function isOpenable(filePath: string): Promise<boolean> {
  const { queue } = await getServices();
  return queue.list().some((job) => job.outputPath === filePath || dirname(job.outputPath) === filePath);
}

const files = createFilesApi(isOpenable);

/**
 * The system API used by the UI. Inputs are still validated here even though
 * the UI is trusted code: the operation schema, not the caller, decides what runs.
 */
export function createStudioApi(): StudioApi {
  return {
    window: windowApi,
    dialog: {
      openFiles: (request) => guard('dialog.openFiles', () => dialogApi.openFiles(request)),
      selectFolder: (defaultPath) => guard('dialog.selectFolder', () => dialogApi.selectFolder(defaultPath)),
    },
    files: {
      onDragDrop: files.onDragDrop,
      showInFolder: (filePath) => guard('files.showInFolder', () => files.showInFolder(filePath)),
      openPath: (filePath) => guard('files.openPath', () => files.openPath(filePath)),
    },
    media: {
      probe: (paths) =>
        guard('media.probe', () => {
          if (!Array.isArray(paths) || paths.length > 5000) throw new UserError(t('Invalid file list.'));
          return probeFiles(paths.map(absolutePath));
        }),
      thumbnail: (filePath) => guard('media.thumbnail', () => createThumbnail(absolutePath(filePath))),
      details: (filePath) =>
        guard('media.details', async () => {
          const path = absolutePath(filePath);
          try {
            return await mediaDetails(path);
          } catch (error) {
            if (error instanceof UserError) throw error;
            throw new UserError(t('FFprobe could not read this file. It may be damaged or not a media file.'));
          }
        }),
    },
    jobs: {
      start: (request) =>
        guard('jobs.start', async (): Promise<StartBatchResult> => {
          const { queue } = await getServices();
          const { specs, warnings } = await createJobs(request, {
            probe: (paths) => probeFiles(paths),
            fontFile: await findSystemFont(),
            reserved: queue.pendingOutputs(),
          });
          return { jobs: queue.add(specs), warnings };
        }),
      list: () => guard('jobs.list', async () => (await getServices()).queue.list()),
      cancel: (id) => guard('jobs.cancel', async () => (await getServices()).queue.cancel(assertString(id, 'job id'))),
      cancelAll: () => guard('jobs.cancelAll', async () => (await getServices()).queue.cancelAll()),
      retry: (id) => guard('jobs.retry', async () => (await getServices()).queue.retry(assertString(id, 'job id'))),
      remove: (id) => guard('jobs.remove', async () => (await getServices()).queue.remove(assertString(id, 'job id'))),
      clearFinished: () => guard('jobs.clearFinished', async () => (await getServices()).queue.clearFinished()),
      getLog: (id) => guard('jobs.getLog', async () => (await getServices()).queue.getLog(assertString(id, 'job id'))),
      onEvent: onJobEvent,
    },
    settings: {
      get: () => guard('settings.get', async () => (await getServices()).settings.get()),
      update: (patch) =>
        guard('settings.update', async () => {
          const { settings, queue } = await getServices();
          const next = await settings.update(patch);
          queue.setConcurrency(next.concurrency);
          setLocale(next.language);
          return next;
        }),
    },
    presets: {
      save: (operationId, name, options) =>
        guard('presets.save', async () => (await getServices()).settings.savePreset(operationId, name, options)),
      delete: (id) => guard('presets.delete', async () => (await getServices()).settings.deletePreset(id)),
    },
    app: {
      environment: () => guard('app.environment', environment),
      onSystemThemeChange,
    },
  };
}
