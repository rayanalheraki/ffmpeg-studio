import { studio } from '../../lib/api';
import { useJobs } from '../../state/jobs';
import { useSettings } from '../../state/settings';
import { IconButton } from '../ui/Button';
import { EmptyState } from '../ui/Feedback';
import { JobItem } from './JobItem';
import { useI18n } from '../../state/i18n';
import styles from './QueuePanel.module.css';

export function QueuePanel(): React.JSX.Element {
  const { jobs, counts, act } = useJobs();
  const { update } = useSettings();
  const { t, tp } = useI18n();
  const active = counts.running + counts.queued;
  const finished = counts.completed + counts.failed + counts.cancelled;
  // Running and queued jobs first, then the most recently finished.
  const ordered = [...jobs].sort((a, b) => rank(a.status) - rank(b.status) || (b.finishedAt ?? 0) - (a.finishedAt ?? 0));

  return (
    <aside className={styles.panel} aria-label={t('Job queue')}>
      <header className={styles.header}>
        <h2 className={styles.title}>{t('Queue')}</h2>
        <IconButton
          icon="ListX"
          label={t('Clear finished jobs')}
          disabled={finished === 0}
          onClick={() => act(() => studio.jobs.clearFinished(), t('Could not clear finished jobs'))}
        />
        <IconButton
          icon="CircleStop"
          label={t('Cancel all jobs')}
          tone="danger"
          disabled={active === 0}
          onClick={() => act(() => studio.jobs.cancelAll(), t('Could not cancel jobs'))}
        />
        <IconButton icon="X" label={t('Hide queue')} onClick={() => update({ queueOpen: false })} />
      </header>
      {jobs.length > 0 && (
        <div className={styles.summary} aria-live="polite">
          <Count value={counts.running} text={tp(counts.running, '{count} running', '{count} running', SLOT)} />
          <Count value={counts.queued} text={tp(counts.queued, '{count} waiting', '{count} waiting', SLOT)} />
          <Count value={counts.completed} text={tp(counts.completed, '{count} done', '{count} done', SLOT)} />
          {counts.failed > 0 && <Count value={counts.failed} text={tp(counts.failed, '{count} failed', '{count} failed', SLOT)} />}
        </div>
      )}
      <div className={styles.list}>
        {ordered.length === 0 ? (
          <EmptyState icon="ListChecks" title={t('No jobs yet')}>
            {t('Add files, choose an operation and press Start. Progress for every file appears here.')}
          </EmptyState>
        ) : (
          ordered.map((job) => <JobItem key={job.id} job={job} />)
        )}
      </div>
    </aside>
  );
}

/** Placeholder kept in translated text so the number can be rendered in bold wherever the language puts it. */
const SLOT = { count: '\u0000' };

function Count({ value, text }: { value: number; text: string }): React.JSX.Element {
  const [before, after] = text.split(SLOT.count);
  return (
    <span>
      {before}
      <strong>{value}</strong>
      {after}
    </span>
  );
}

function rank(status: string): number {
  return status === 'running' ? 0 : status === 'queued' ? 1 : 2;
}
