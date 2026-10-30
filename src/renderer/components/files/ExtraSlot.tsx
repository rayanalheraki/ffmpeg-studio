import { LoaderCircle } from 'lucide-react';
import type { ExtraSlot as ExtraSlotDefinition, OptionValues } from '@shared/operations/types';
import { isSlotRequired } from '@shared/jobs/plan';
import { useFileDrop } from '../../hooks/useFileDrop';
import { Icon } from '../../lib/Icon';
import { cx } from '../../lib/cx';
import { useFiles } from '../../state/files';
import { Button, IconButton } from '../ui/Button';
import styles from './ExtraSlot.module.css';

const SLOT_ICONS = { audio: 'FileMusic', image: 'Image', subtitle: 'Captions', video: 'Film', unknown: 'File' } as const;

interface ExtraSlotProps {
  slot: ExtraSlotDefinition;
  options: OptionValues;
  onBrowse(slotId: string): void;
}

/** A secondary input such as the watermark image or the new soundtrack. Accepts drops too. */
export function ExtraSlot({ slot, options, onBrowse }: ExtraSlotProps): React.JSX.Element {
  const { slots, addPaths, remove } = useFiles();
  const entries = slots[slot.id] ?? [];
  const { active, handlers } = useFileDrop((paths) => addPaths(slot.id, slot.multiple ? paths : paths.slice(0, 1), !slot.multiple));
  const required = isSlotRequired(slot, options);
  const icon = SLOT_ICONS[slot.accept[0] ?? 'unknown'];

  return (
    <section className={cx(styles.slot, active && styles.active)} aria-label={slot.label} {...handlers}>
      <div className={styles.header}>
        <span className={styles.icon}>
          <Icon name={icon} size={15} />
        </span>
        <div className={styles.text}>
          <p className={styles.label}>
            {slot.label}
            {required && entries.length === 0 && <span className={styles.required}>Required</span>}
          </p>
          {slot.description && <p className={styles.description}>{slot.description}</p>}
        </div>
        <Button size="sm" icon={entries.length > 0 && !slot.multiple ? 'Replace' : 'Plus'} onClick={() => onBrowse(slot.id)}>
          {entries.length > 0 && !slot.multiple ? 'Replace' : 'Add'}
        </Button>
      </div>
      {entries.length > 0 ? (
        <ul className={styles.files}>
          {entries.map((entry, index) => (
            <li key={entry.key} className={styles.chip} title={entry.path}>
              {entries.length > 1 && <span className={styles.chipIndex}>{index + 1}</span>}
              {entry.file == null && <LoaderCircle size={12} className="spin" aria-label="Reading file" />}
              <span className={styles.chipName}>{entry.file?.fileName ?? entry.path}</span>
              <IconButton icon="X" label={`Remove ${entry.file?.fileName ?? 'file'}`} onClick={() => remove(slot.id, entry.key)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Drop a file here or click Add.</p>
      )}
    </section>
  );
}
