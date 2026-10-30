import { Ban, CircleCheck, CircleX, ChevronRight, Clock, LoaderCircle } from 'lucide-react';
import { Fragment, memo, useState } from 'react';
import type { JobSnapshot, JobStatus } from '@shared/types/jobs';
import { formatBytes, formatMs, formatResolution } from '@shared/utils/format';
import { basename } from '@shared/utils/path';
import { studio } from '../../lib/api';
import { useJobs } from '../../state/jobs';
import { IconButton } from '../ui/Button';
import { Badge, ProgressBar } from '../ui/Feedback';
import { JobLog } from './JobLog';
import { msg } from '@shared/i18n';
import { useI18n } from '../../state/i18n';
import type { I18n } from '../../state/i18n';
import styles from './JobItem.module.css';

const STATUS_ICON: Record<JobStatus, React.JSX.Element> = {
  queued: <Clock size={13} strokeWidth={2} />,
  running: <LoaderCircle size={13} strokeWidth={2.25} />,
  completed: <CircleCheck size={13} strokeWidth={2.25} />,
  failed: <CircleX size={13} strokeWidth={2.25} />,
  cancelled: <Ban size={13} strokeWidth={2} />,
};

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: msg('Waiting'),
  running: msg('Running'),
  completed: msg('Done'),
  failed: msg('Failed'),
  cancelled: msg('Cancelled'),
};

function outputDetails(job: JobSnapshot, t: I18n['t']): string[] {
  const { output, startedAt, finishedAt } = job;
  return [
    output && formatBytes(output.size),
    output && formatResolution(output.width, output.height),
    startedAt && finishedAt ? t('Finished in {time}', { time: formatMs(finishedAt - startedAt) }) : null,
  ].filter((item): item is string => Boolean(item));
}

function JobItemComponent({ job }: { job: JobSnapshot }): React.JSX.Element {
  const { act } = useJobs();
  const [showLog, setShowLog] = useState(false);
  const { t } = useI18n();
  const statusLabel = t(STATUS_LABEL[job.status]);
  const { progress, status } = job;
  const isActive = status === 'running' || status === 'queued';

  return (
    <article className={styles.item} data-status={status} aria-label={`${job.title}: ${statusLabel}`}>
      <div className={styles.top}>
        <span className={styles.status} data-status={status} title={statusLabel}>
          {STATUS_ICON[status]}
        </span>
        <div className={styles.text}>
          <p className={styles.title} title={job.inputPaths.join('\n')} dir="auto">
            {job.title}
          </p>
          <p className={styles.meta} title={job.outputPath}>
            {t('{operation} → {file}', { operation: t(job.operationLabel), file: basename(job.outputPath) })}
          </p>
        </div>
        <div className={styles.actions}>
          {isActive && (
            <IconButton
              icon="X"
              label={t('Cancel job')}
              onClick={() => act(() => studio.jobs.cancel(job.id), t('Could not cancel the job'))}
            />
          )}
          {(status === 'failed' || status === 'cancelled') && !job.skipped && (
            <IconButton
              icon="RotateCcw"
              label={t('Retry job')}
              onClick={() => act(() => studio.jobs.retry(job.id), t('Could not retry the job'))}
            />
          )}
          {status === 'completed' && (
            <>
              <IconButton
                icon="Play"
                label={t('Open output')}
                onClick={() => act(() => studio.files.openPath(job.outputPath), t('Could not open the file'))}
              />
              <IconButton
                icon="FolderOpen"
                label={t('Show in folder')}
                onClick={() => act(() => studio.files.showInFolder(job.outputPath), t('Could not open the folder'))}
              />
            </>
          )}
          {!isActive && (
            <IconButton
              icon="Trash"
              label={t('Remove from list')}
              onClick={() => act(() => studio.jobs.remove(job.id), t('Could not remove the job'))}
            />
          )}
        </div>
      </div>

      {status === 'running' && (
        <div className={styles.progress}>
          <ProgressBar value={progress.percent} label={t('Progress of {name}', { name: job.title })} />
          <div className={styles.stats}>
            <span className={styles.percent}>{progress.percent == null ? t('Working…') : `${Math.floor(progress.percent)}%`}</span>
            <span>{progress.speed ? `${progress.speed.toFixed(2)}×` : '—'}</span>
            <span>{t('{time} elapsed', { time: formatMs(progress.elapsedMs) })}</span>
            <span>{progress.etaMs == null ? t('ETA —') : t('{time} left', { time: formatMs(progress.etaMs) })}</span>
          </div>
        </div>
      )}
      {status === 'completed' && (job.output || (job.startedAt && job.finishedAt)) && (
        <div className={styles.output}>
          {job.output?.ext && <Badge tone="success">{job.output.ext.toUpperCase()}</Badge>}
          {outputDetails(job, t).map((item, index) => (
            <Fragment key={`${item}-${index}`}>
              {index > 0 && <span className={styles.dot} />}
              <span>{item}</span>
            </Fragment>
          ))}
        </div>
      )}
      {(status === 'failed' || status === 'cancelled') && job.message && <p className={styles.message}>{job.message}</p>}

      {job.hasLog && status !== 'running' && (
        <>
          <button type="button" className={styles.logToggle} aria-expanded={showLog} onClick={() => setShowLog(!showLog)}>
            <ChevronRight size={12} />
            {showLog ? t('Hide FFmpeg log') : t('Show FFmpeg log')}
          </button>
          {showLog && <JobLog job={job} />}
        </>
      )}
    </article>
  );
}

export const JobItem = memo(JobItemComponent);
