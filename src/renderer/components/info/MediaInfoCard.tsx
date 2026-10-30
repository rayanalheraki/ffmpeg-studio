import type { MediaFile } from '@shared/types/media';
import { formatBitRate, formatBytes } from '@shared/utils/format';
import { formatDuration } from '@shared/utils/time';
import { useMediaDetails } from '../../hooks/useMediaDetails';
import { IconButton } from '../ui/Button';
import { Skeleton } from '../ui/Feedback';
import { FileThumbnail } from '../files/FileThumbnail';
import { StreamRow } from './StreamRow';
import { msg } from '@shared/i18n';
import { useI18n } from '../../state/i18n';
import styles from './MediaInfoCard.module.css';

/** FFprobe output presented as a readable card instead of raw JSON. */
export function MediaInfoCard({ file, onRemove }: { file: MediaFile; onRemove(): void }): React.JSX.Element {
  const state = useMediaDetails(file.path);
  const { t } = useI18n();

  return (
    <article className={styles.card} aria-label={t('Media information for {name}', { name: file.fileName })}>
      <header className={styles.header}>
        <FileThumbnail file={file} />
        <div className={styles.headerText}>
          <h3 className={styles.name} title={file.fileName} dir="auto">
            {file.fileName}
          </h3>
          <p className={styles.format}>{state.status === 'ready' ? (state.details.formatLongName ?? state.details.formatName) : ' '}</p>
          <p className={styles.path} title={file.path} dir="ltr">
            {file.path}
          </p>
        </div>
        <IconButton icon="X" label={t('Remove file')} onClick={onRemove} />
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
              [msg('Duration'), formatDuration(state.details.duration)],
              [msg('Size'), formatBytes(state.details.size)],
              [msg('Bit rate'), formatBitRate(state.details.bitRate)],
              [msg('Streams'), String(state.details.streams.length)],
              [msg('Chapters'), String(state.details.chapters)],
            ].map(([label, value]) => (
              <div key={label} className={styles.stat}>
                <p className={styles.statLabel}>{t(label)}</p>
                <p className={styles.statValue}>{value}</p>
              </div>
            ))}
          </div>
          <section className={styles.section}>
            <h4 className={styles.sectionTitle}>{t('Streams')}</h4>
            <div className={styles.streams}>
              {state.details.streams.map((stream) => (
                <StreamRow key={stream.index} stream={stream} />
              ))}
            </div>
          </section>
          {Object.keys(state.details.tags).length > 0 && (
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>{t('Tags')}</h4>
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
