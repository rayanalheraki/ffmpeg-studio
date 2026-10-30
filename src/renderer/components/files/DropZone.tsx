import { Upload } from 'lucide-react';
import type { MediaKind } from '@shared/types/media';
import { useFileDrop } from '../../hooks/useFileDrop';
import { MOD_KEY } from '../../lib/api';
import { cx } from '../../lib/cx';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Feedback';
import { formatList, msg } from '@shared/i18n';
import { useI18n } from '../../state/i18n';
import type { I18n } from '../../state/i18n';
import styles from './DropZone.module.css';

interface DropZoneProps {
  accept: MediaKind[];
  compact?: boolean;
  label?: string;
  onFiles(paths: string[]): void;
  onBrowse(): void;
}

/** Kind names as used inside sentences ("Add video or audio files"). */
const KIND_NOUNS: Record<MediaKind, string> = {
  video: msg('video'),
  audio: msg('audio'),
  image: msg('image'),
  subtitle: msg('subtitle'),
  unknown: msg('media'),
};

function describe(kinds: MediaKind[], { t, locale }: I18n): string {
  return kinds.length > 0
    ? formatList(
        kinds.map((kind) => t(KIND_NOUNS[kind])),
        'disjunction',
        locale,
      )
    : t(KIND_NOUNS.unknown);
}

/** The primary drop target. Large and inviting when empty, a slim bar once files exist. */
export function DropZone({ accept, compact = false, label, onFiles, onBrowse }: DropZoneProps): React.JSX.Element {
  const { active, handlers } = useFileDrop(onFiles);
  const i18n = useI18n();
  const { t } = i18n;
  const kinds = describe(accept, i18n);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t('Add {kinds} files', { kinds })}
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
          {active ? t('Release to add files') : compact ? t('Drop more files here') : (label ?? t('Drop your files here'))}
        </p>
        <p className={styles.subtitle}>
          {compact
            ? t('Any {kinds} files', { kinds })
            : t('Add as many {kinds} files as you like. Each one becomes its own job.', { kinds })}
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
          {t('Browse files')}
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
