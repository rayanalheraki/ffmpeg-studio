import { useRef, type KeyboardEvent } from 'react';
import type { Choice } from '@shared/operations/types';
import styles from './Toggle.module.css';

interface SegmentedControlProps {
  id?: string;
  value: string;
  choices: Choice[];
  onChange(value: string): void;
  'aria-label'?: string;
  /** Show the selected choice's hint under the control. */
  showHint?: boolean;
}

/** Radio group styled as a pill switcher, navigable with arrow keys. */
export function SegmentedControl({ id, value, choices, onChange, showHint = true, ...rest }: SegmentedControlProps): React.JSX.Element {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = choices.find((choice) => choice.value === value);

  const onKeyDown = (event: KeyboardEvent, index: number): void => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = (index + delta + choices.length) % choices.length;
    const choice = choices[next];
    if (!choice) return;
    onChange(choice.value);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div id={id} role="radiogroup" aria-label={rest['aria-label']} className={styles.segmented}>
        {choices.map((choice, index) => {
          const checked = choice.value === value;
          return (
            <button
              key={choice.value}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked || (!selected && index === 0) ? 0 : -1}
              className={styles.segment}
              title={choice.hint}
              onClick={() => onChange(choice.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
      {showHint && selected?.hint && <p className={styles.hint}>{selected.hint}</p>}
    </div>
  );
}
