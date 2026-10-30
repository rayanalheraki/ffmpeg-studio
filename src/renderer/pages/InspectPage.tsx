import type { AnyOperation } from '@shared/operations/types';
import { DropZone } from '../components/files/DropZone';
import { MediaInfoCard } from '../components/info/MediaInfoCard';
import { Skeleton } from '../components/ui/Feedback';
import { useAddFiles } from '../hooks/useAddFiles';
import { useFileDrop } from '../hooks/useFileDrop';
import { useHotkeys } from '../hooks/useHotkeys';
import { Icon } from '../lib/Icon';
import { useFiles } from '../state/files';
import { MAIN_SLOT } from '../state/files-reducer';
import { useI18n } from '../state/i18n';
import styles from './Page.module.css';

/** For `inspect` operations: shows information about each file instead of creating jobs. */
export function InspectPage({ operation }: { operation: AnyOperation }): React.JSX.Element {
  const { slots, remove } = useFiles();
  const { route, browse } = useAddFiles(operation, {});
  const { setZone: setPageZone } = useFileDrop(route);
  useHotkeys({ 'mod+o': () => browse() });
  const { t } = useI18n();
  const entries = slots[MAIN_SLOT] ?? [];

  return (
    <div className={styles.page} ref={setPageZone}>
      <div className={styles.scroll}>
        <header className={styles.header} style={{ maxWidth: 900 }}>
          <span className={styles.headerIcon}>
            <Icon name={operation.icon} size={20} />
          </span>
          <div className={styles.headerText}>
            <h1 className={styles.title}>{t(operation.label)}</h1>
            <p className={styles.description}>{t(operation.description)}</p>
          </div>
        </header>
        <div className={styles.infoList}>
          <DropZone compact={entries.length > 0} accept={operation.input.accept} onFiles={route} onBrowse={() => browse()} />
          {entries.map((entry) =>
            entry.file ? (
              <MediaInfoCard key={entry.key} file={entry.file} onRemove={() => remove(MAIN_SLOT, entry.key)} />
            ) : (
              <Skeleton key={entry.key} height={180} radius={16} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
