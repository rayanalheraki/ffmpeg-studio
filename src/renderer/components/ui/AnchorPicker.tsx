import type { KeyboardEvent } from 'react';
import type { Anchor } from '@shared/operations/types';
import styles from './Pickers.module.css';

const GRID: Anchor[] = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];

interface AnchorPickerProps {
  value: Anchor;
  onChange(value: Anchor): void;
}

/** 3×3 position picker shaped like a video frame; arrow keys move the selection. */
export function AnchorPicker({ value, onChange }: AnchorPickerProps): React.JSX.Element {
  const index = GRID.indexOf(value);

  const onKeyDown = (event: KeyboardEvent): void => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
    const move = moves[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const next = GRID[index + move];
    const sameRow = Math.abs(move) === 3 || Math.floor((index + move) / 3) === Math.floor(index / 3);
    if (next && sameRow) onChange(next);
  };

  return (
    <div className={styles.anchorRow}>
      <div className={styles.anchors} role="radiogroup" aria-label="Position" onKeyDown={onKeyDown}>
        {GRID.map((anchor) => (
          <button
            key={anchor}
            type="button"
            role="radio"
            aria-checked={anchor === value}
            aria-label={anchor.replace('-', ' ')}
            tabIndex={anchor === value ? 0 : -1}
            className={styles.anchor}
            onClick={() => onChange(anchor)}
          />
        ))}
      </div>
      <span className={styles.anchorLabel}>{value.replace('-', ' ')}</span>
    </div>
  );
}
