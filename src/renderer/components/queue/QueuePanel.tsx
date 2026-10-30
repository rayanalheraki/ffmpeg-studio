import { studio } from '../../lib/api';
import { useJobs } from '../../state/jobs';
import { useSettings } from '../../state/settings';
import { IconButton } from '../ui/Button';
import { EmptyState } from '../ui/Feedback';
import { JobItem } from './JobItem';
import styles from './QueuePanel.module.css';

export function QueuePanel(): React.JSX.Element {
  const { jobs, counts, act } = useJobs();
  const { update } = useSettings();
  const active = counts.running + counts.queued;
  const finished = counts.completed + counts.failed + counts.cancelled;
  // Running and queued jobs first, then the most recently finished.
  const ordered = [...jobs].sort((a, b) => rank(a.status) - rank(b.status) || (b.finishedAt ?? 0) - (a.finishedAt ?? 0));

  return (
    <aside className={styles.panel} aria-label="Job queue">
      <header className={styles.header}>
        <h2 className={styles.title}>Queue</h2>
        <IconButton
          icon="ListX"
          label="Clear finished jobs"
          disabled={finished === 0}
          onClick={() => act(() => studio.jobs.clearFinished(), 'Could not clear finished jobs')}
        />
        <IconButton
          icon="CircleStop"
          label="Cancel all jobs"
          tone="danger"
          disabled={active === 0}
          onClick={() => act(() => studio.jobs.cancelAll(), 'Could not cancel jobs')}
        />
        <IconButton icon="X" label="Hide queue" onClick={() => update({ queueOpen: false })} />
      </header>
      {jobs.length > 0 && (
        <div className={styles.summary} aria-live="polite">
          <span>
            <strong>{counts.running}</strong> running
          </span>
          <span>
            <strong>{counts.queued}</strong> waiting
          </span>
          <span>
            <strong>{counts.completed}</strong> done
          </span>
          {counts.failed > 0 && (
            <span>
              <strong>{counts.failed}</strong> failed
            </span>
          )}
        </div>
      )}
      <div className={styles.list}>
        {ordered.length === 0 ? (
          <EmptyState icon="ListChecks" title="No jobs yet">
            Add files, choose an operation and press Start. Progress for every file appears here.
          </EmptyState>
        ) : (
          ordered.map((job) => <JobItem key={job.id} job={job} />)
        )}
      </div>
    </aside>
  );
}

function rank(status: string): number {
  return status === 'running' ? 0 : status === 'queued' ? 1 : 2;
}
