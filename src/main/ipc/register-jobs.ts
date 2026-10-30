import { setLocale } from '@shared/i18n';
import { IPC } from '@shared/ipc';
import type { StartBatchResult } from '@shared/types/jobs';
import type { SettingsStore } from '../settings/settings-store';
import { probeFiles } from '../media/probe';
import { findSystemFont } from '../utils/fonts';
import type { JobQueue } from '../queue/job-queue';
import { createJobs } from '../queue/create-jobs';
import { assertString, handle } from './handle';

export interface JobsDeps {
  queue: JobQueue;
  settings: SettingsStore;
}

export function registerJobsIpc({ queue, settings }: JobsDeps): void {
  handle(IPC.jobsStart, async (request): Promise<StartBatchResult> => {
    const { specs, warnings } = await createJobs(request, {
      probe: (paths) => probeFiles(paths),
      fontFile: findSystemFont(),
      reserved: queue.pendingOutputs(),
    });
    return { jobs: queue.add(specs), warnings };
  });
  handle(IPC.jobsList, () => queue.list());
  handle(IPC.jobsCancel, (id) => queue.cancel(assertString(id, 'job id')));
  handle(IPC.jobsCancelAll, () => queue.cancelAll());
  handle(IPC.jobsRetry, (id) => queue.retry(assertString(id, 'job id')));
  handle(IPC.jobsRemove, (id) => queue.remove(assertString(id, 'job id')));
  handle(IPC.jobsClearFinished, () => queue.clearFinished());
  handle(IPC.jobsGetLog, (id) => queue.getLog(assertString(id, 'job id')));

  handle(IPC.settingsGet, () => settings.get());
  handle(IPC.settingsUpdate, (patch) => {
    const next = settings.update(patch);
    queue.setConcurrency(next.concurrency);
    setLocale(next.language);
    return next;
  });
  handle(IPC.presetsSave, (operationId, name, options) => settings.savePreset(operationId, name, options));
  handle(IPC.presetsDelete, (id) => settings.deletePreset(id));
}
