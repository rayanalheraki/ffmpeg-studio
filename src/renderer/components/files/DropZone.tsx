import { Upload } from 'lucide-react';
import type { MediaKind } from '@shared/types/media';
import { KIND_LABELS } from '@shared/media/kinds';
import { useFileDrop } from '../../hooks/useFileDrop';
import { MOD_KEY } from '../../lib/api';
import { cx } from '../../lib/cx';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Feedback';
import styles from './DropZone.module.css';

interface DropZoneProps {
  accept: MediaKind[];
  compact?: boolean;
  label?: string;
  onFiles(paths: string[]): void;
  onBrowse(): void;
}

function describe(kinds: MediaKind[]): string {
  const names = kinds.map((kind) => KIND_LABELS[kind].toLowerCase());
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : (names[0] ?? 'media');
}

/** The primary drop target. Large and inviting when empty, a slim bar once files exist. */
export function DropZone({ accept, compact = false, label, onFiles, onBrowse }: DropZoneProps): React.JSX.Element {
  const { active, handlers } = useFileDrop(onFiles);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Add ${describe(accept)} files`}
      className={cx(styles.zone, compact && styles.compact, active && styles.active)}
      onClick={onBrowse}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onBrowse();
        }
      }}
      {...handlers}
    >
      <div className={styles.icon}>
        <Upload size={compact ? 16 : 22} strokeWidth={1.75} />
      </div>
      <div>
        <p className={styles.title}>
          {active ? 'Release to add files' : compact ? 'Drop more files here' : (label ?? 'Drop your files here')}
        </p>
        <p className={styles.subtitle}>
          {compact ? `Any ${describe(accept)} files` : `Add as many ${describe(accept)} files as you like. Each one becomes its own job.`}
        </p>
      </div>
      <div className={styles.actions}>
        <Button
          variant={compact ? 'ghost' : 'primary'}
          size={compact ? 'sm' : 'md'}
          icon="FolderOpen"
          onClick={(event) => {
            event.stopPropagation();
            onBrowse();
          }}
        >
          Browse files
        </Button>
        {!compact && (
          <span className={styles.hint}>
            <Kbd>{MOD_KEY}</Kbd>
            <Kbd>O</Kbd>
          </span>
        )}
      </div>
    </div>
  );
}
