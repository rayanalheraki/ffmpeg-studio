import { useEffect, useState } from 'react';
import type { JobSnapshot } from '@shared/types/jobs';
import { formatCommand } from '@shared/jobs/command';
import { errorMessage, studio } from '../../lib/api';
import { useSettings } from '../../state/settings';
import { useToasts } from '../../state/toasts';
import { IconButton } from '../ui/Button';
import { Skeleton } from '../ui/Feedback';
import styles from './JobLog.module.css';

/** The complete FFmpeg command and stderr output of a finished job. */
export function JobLog({ job }: { job: JobSnapshot }): React.JSX.Element {
  const { environment } = useSettings();
  const { show } = useToasts();
  const [log, setLog] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    studio.jobs
      .getLog(job.id)
      .then((text) => active && setLog(text))
      .catch((error: unknown) => active && setLog(`The log could not be loaded: ${errorMessage(error)}`));
    return () => {
      active = false;
    };
  }, [job.id, job.finishedAt]);

  const command = formatCommand(job.command, environment.platform);
  const copy = (): void => {
    navigator.clipboard
      .writeText(`$ ${command}\n\n${log ?? ''}`)
      .then(() => show('success', 'Log copied to the clipboard'))
      .catch((error: unknown) => show('error', 'Could not copy', errorMessage(error)));
  };

  return (
    <div className={styles.log}>
      <div className={styles.toolbar}>
        <span>FFmpeg output</span>
        <IconButton icon="Copy" label="Copy command and log" onClick={copy} />
      </div>
      {log == null ? (
        <div className={styles.loading}>
          <Skeleton height={10} width="90%" />
          <Skeleton height={10} width="70%" />
          <Skeleton height={10} width="80%" />
        </div>
      ) : (
        <pre className={styles.pre}>
          <span className={styles.command}>$ {command}</span>
          {'\n\n'}
          {log.trim() || 'FFmpeg did not print any output.'}
        </pre>
      )}
    </div>
  );
}
