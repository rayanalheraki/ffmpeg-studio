import type { AnyOperation } from '@shared/operations/types';
import { acceptsFile } from '@shared/jobs/plan';
import { useReorder } from '../../hooks/useReorder';
import type { FileEntry } from '../../state/files-reducer';
import { Button } from '../ui/Button';
import { FileCard } from './FileCard';
import { useI18n } from '../../state/i18n';
import styles from './FileList.module.css';

interface FileListProps {
  operation: AnyOperation;
  entries: FileEntry[];
  /** Per-file reasons a job will be skipped, keyed by path. */
  excluded: Map<string, string>;
  onRemove(key: string): void;
  onMove(from: number, to: number): void;
  onClear(): void;
  onBrowse(): void;
}

export function FileList({ operation, entries, excluded, onRemove, onMove, onClear, onBrowse }: FileListProps): React.JSX.Element {
  const { itemProps } = useReorder(onMove);
  const { t } = useI18n();
  const ordered = operation.batch === 'combine';
  const usable = entries.filter(
    (entry) => entry.file && acceptsFile(operation.input.accept, entry.file) && !excluded.has(entry.path),
  ).length;

  return (
    <section className={styles.wrapper} aria-label={t('Input files')}>
      <div className={styles.header}>
        <h2 className={styles.heading}>
          {operation.input.label ? t(operation.input.label) : t('Files')}
          <span className={styles.count}>
            {usable === entries.length ? `${entries.length}` : t('{usable} of {total} usable', { usable, total: entries.length })}
          </span>
        </h2>
        <Button variant="ghost" size="sm" icon="Plus" onClick={onBrowse}>
          {t('Add')}
        </Button>
        <Button variant="ghost" size="sm" icon="Trash" onClick={onClear}>
          {t('Clear all')}
        </Button>
      </div>
      <ul className={styles.list}>
        {entries.map((entry, index) => {
          const file = entry.file;
          const supported = file == null || (acceptsFile(operation.input.accept, file) && !excluded.has(entry.path));
          return (
            <FileCard
              key={entry.key}
              entry={entry}
              position={ordered ? index + 1 : undefined}
              supported={supported}
              unsupportedReason={excluded.get(entry.path)}
              onRemove={() => onRemove(entry.key)}
              onMove={(delta) => onMove(index, index + delta)}
              drag={itemProps(index)}
            />
          );
        })}
      </ul>
    </section>
  );
}
