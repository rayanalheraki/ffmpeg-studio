import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { JobEvent, JobSnapshot, JobStatus } from '@shared/types/jobs';
import { errorMessage, studio } from '../lib/api';
import { useToasts } from './toasts';
import { t } from '@shared/i18n';

type Counts = Record<JobStatus, number>;

interface JobsApi {
  jobs: JobSnapshot[];
  counts: Counts;
  /** Runs a queue action and reports failures as a toast. */
  act(action: () => Promise<void>, failure: string): void;
}

const JobsContext = createContext<JobsApi | null>(null);

function applyEvent(jobs: JobSnapshot[], event: JobEvent): JobSnapshot[] {
  if (event.type === 'remove') return jobs.filter((job) => !event.ids.includes(job.id));
  const index = jobs.findIndex((job) => job.id === event.job.id);
  if (index < 0) return [...jobs, event.job];
  const next = jobs.slice();
  next[index] = event.job;
  return next;
}

export function JobsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { show } = useToasts();
  const [jobs, setJobs] = useState<JobSnapshot[]>([]);

  useEffect(() => {
    // Subscribe first so no event between listing and subscribing is lost.
    const unsubscribe = studio.jobs.onEvent((event) => setJobs((current) => applyEvent(current, event)));
    studio.jobs
      .list()
      .then((list) => setJobs((current) => (current.length === 0 ? list : current)))
      .catch((error: unknown) => show('error', t('Could not load the job queue'), errorMessage(error)));
    return unsubscribe;
  }, [show]);

  const act = useCallback(
    (action: () => Promise<void>, failure: string) => {
      action().catch((error: unknown) => show('error', failure, errorMessage(error)));
    },
    [show],
  );

  const counts = useMemo(() => {
    const result: Counts = { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
    for (const job of jobs) result[job.status] += 1;
    return result;
  }, [jobs]);

  const value = useMemo(() => ({ jobs, counts, act }), [jobs, counts, act]);
  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs(): JobsApi {
  const context = useContext(JobsContext);
  if (!context) throw new Error('useJobs must be used inside <JobsProvider>.');
  return context;
}
