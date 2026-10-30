import { GripVertical } from 'lucide-react';
import { Fragment, memo, type DragEvent, type KeyboardEvent } from 'react';
import { formatBytes, formatResolution } from '@shared/utils/format';
import { KIND_LABELS } from '@shared/media/kinds';
import { cx } from '../../lib/cx';
import type { FileEntry } from '../../state/files-reducer';
import { IconButton } from '../ui/Button';
import { Badge, Skeleton } from '../ui/Feedback';
import { FileThumbnail } from './FileThumbnail';
import { useI18n } from '../../state/i18n';
import styles from './FileCard.module.css';

export interface CardDragProps {
  draggable: boolean;
  dragging: boolean;
  dropPosition: 'before' | 'after' | null;
  onDragStart(event: DragEvent): void;
  onDragOver(event: DragEvent): void;
  onDragEnd(): void;
  onDrop(event: DragEvent): void;
}

interface FileCardProps {
  entry: FileEntry;
  /** 1-based position, shown when order matters (e.g. merge). */
  position?: number;
  supported: boolean;
  unsupportedReason?: string;
  onRemove(): void;
  onMove(delta: -1 | 1): void;
  drag: CardDragProps;
}

function FileCardComponent({ entry, position, supported, unsupportedReason, onRemove, onMove, drag }: FileCardProps): React.JSX.Element {
  const { file } = entry;
  const { t } = useI18n();
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      onMove(event.key === 'ArrowUp' ? -1 : 1);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onRemove();
    }
  };

  const meta = file
    ? [
        formatBytes(file.size),
        formatResolution(file.width, file.height),
        file.videoCodec?.toUpperCase(),
        file.audioCodec?.toUpperCase(),
      ].filter(Boolean)
    : [];

  return (
    <li
      className={cx(
        styles.card,
        drag.dragging && styles.dragging,
        !supported && styles.unsupported,
        drag.dropPosition === 'before' && styles.dropBefore,
        drag.dropPosition === 'after' && styles.dropAfter,
      )}
      tabIndex={0}
      aria-label={
        position
          ? t('{path}, position {position}. Alt+Arrow keys to reorder, Delete to remove.', { path: entry.path, position })
          : t('{path}. Alt+Arrow keys to reorder, Delete to remove.', { path: entry.path })
      }
      draggable={drag.draggable}
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDragEnd={drag.onDragEnd}
      onDrop={drag.onDrop}
      onKeyDown={onKeyDown}
    >
      <span className={styles.handle} aria-hidden="true">
        <GripVertical size={14} />
      </span>
      {position != null && <span className={styles.index}>{position}</span>}
      {file ? <FileThumbnail file={file} /> : <Skeleton className={styles.thumb} />}
      <div className={styles.body}>
        {file ? (
          <>
            <p className={styles.name} title={file.path} dir="auto">
              {file.fileName}
            </p>
            <div className={styles.meta}>
              <Badge tone={supported ? 'neutral' : 'warning'}>{file.ext.toUpperCase() || t(KIND_LABELS[file.kind])}</Badge>
              {meta.map((item, index) => (
                <Fragment key={`${item}-${index}`}>
                  {index > 0 && <span className={styles.dot} />}
                  <span>{item}</span>
                </Fragment>
              ))}
            </div>
            {!supported && (
              <div className={styles.meta}>
                <Badge tone="warning" icon="TriangleAlert">
                  {file.probeError ?? unsupportedReason ?? t('Not used by this operation')}
                </Badge>
              </div>
            )}
          </>
        ) : (
          <div className={styles.skeletonLines}>
            <Skeleton width="60%" height={12} />
            <Skeleton width="40%" height={10} />
          </div>
        )}
      </div>
      <div className={styles.actions}>
        <IconButton icon="ArrowUp" label={t('Move up')} onClick={() => onMove(-1)} />
        <IconButton icon="ArrowDown" label={t('Move down')} onClick={() => onMove(1)} />
        <IconButton icon="X" label={t('Remove file')} tone="danger" onClick={onRemove} />
      </div>
    </li>
  );
}

export const FileCard = memo(FileCardComponent);
