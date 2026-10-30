import type { MediaFile } from '@shared/types/media';
import { formatBitRate, formatBytes } from '@shared/utils/format';
import { formatDuration } from '@shared/utils/time';
import { useMediaDetails } from '../../hooks/useMediaDetails';
import { IconButton } from '../ui/Button';
import { Skeleton } from '../ui/Feedback';
import { FileThumbnail } from '../files/FileThumbnail';
import { StreamRow } from './StreamRow';
import styles from './MediaInfoCard.module.css';

/** FFprobe output presented as a readable card instead of raw JSON. */
export function MediaInfoCard({ file, onRemove }: { file: MediaFile; onRemove(): void }): React.JSX.Element {
  const state = useMediaDetails(file.path);

  return (
    <article className={styles.card} aria-label={`Media information for ${file.fileName}`}>
      <header className={styles.header}>
        <FileThumbnail file={file} />
        <div className={styles.headerText}>
          <h3 className={styles.name} title={file.fileName}>
            {file.fileName}
          </h3>
          <p className={styles.format}>{state.status === 'ready' ? (state.details.formatLongName ?? state.details.formatName) : ' '}</p>
          <p className={styles.path} title={file.path}>
            {file.path}
          </p>
        </div>
        <IconButton icon="X" label="Remove file" onClick={onRemove} />
      </header>

      {state.status === 'loading' && (
        <div className={styles.loading}>
          <Skeleton height={44} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </div>
      )}
      {state.status === 'error' && <p className={styles.error}>{state.message}</p>}
      {state.status === 'ready' && (
        <>
          <div className={styles.stats}>
            {[
              ['Duration', formatDuration(state.details.duration)],
              ['Size', formatBytes(state.details.size)],
              ['Bit rate', formatBitRate(state.details.bitRate)],
              ['Streams', String(state.details.streams.length)],
              ['Chapters', String(state.details.chapters)],
            ].map(([label, value]) => (
              <div key={label} className={styles.stat}>
                <p className={styles.statLabel}>{label}</p>
                <p className={styles.statValue}>{value}</p>
              </div>
            ))}
          </div>
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>Streams</h4>
            <div className={styles.streams}>
              {state.details.streams.map((stream) => (
                <StreamRow key={stream.index} stream={stream} />
              ))}
            </div>
          </section>
          {Object.keys(state.details.tags).length > 0 && (
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>Tags</h4>
              <dl className={styles.tags}>
                {Object.entries(state.details.tags).map(([key, value]) => (
                  <div key={key} style={{ display: 'contents' }}>
                    <dt>{key.replace(/_/g, ' ')}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </>
      )}
    </article>
  );
}
