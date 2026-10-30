import { ChevronDown, ChevronUp } from 'lucide-react';
import { useDraft } from '../../hooks/useDraft';
import { cx } from '../../lib/cx';
import styles from './Input.module.css';

interface NumberInputProps {
  id?: string;
  value: number;
  onChange(value: number): void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number): number {
  const decimals = (String(step).split('.')[1] ?? '').length;
  return Number(value.toFixed(decimals));
}

/**
 * Numeric input with custom steppers. The text is edited freely and committed
 * (clamped) on blur or Enter, so partially typed values are never rejected.
 */
export function NumberInput({ id, value, onChange, min, max, step, unit, disabled, ...rest }: NumberInputProps): React.JSX.Element {
  const [draft, setDraft] = useDraft(value, String);

  const commit = (raw: string): void => {
    const parsed = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = clamp(roundToStep(parsed, step), min, max);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  const nudge = (direction: 1 | -1): void => onChange(clamp(roundToStep(value + step * direction, step), min, max));

  return (
    <div className={cx(styles.control, styles.number, disabled && styles.disabled)}>
      <input
        id={id}
        className={cx(styles.input, styles.mono)}
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        aria-label={rest['aria-label']}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        role="spinbutton"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget.value);
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            nudge(1);
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            nudge(-1);
          }
        }}
      />
      {unit && <span className={styles.adornment}>{unit}</span>}
      <div className={styles.steppers}>
        <button
          type="button"
          className={styles.stepper}
          tabIndex={-1}
          aria-label="Increase"
          disabled={disabled || value >= max}
          onClick={() => nudge(1)}
        >
          <ChevronUp size={12} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={styles.stepper}
          tabIndex={-1}
          aria-label="Decrease"
          disabled={disabled || value <= min}
          onClick={() => nudge(-1)}
        >
          <ChevronDown size={12} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
