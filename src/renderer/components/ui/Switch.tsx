import { Check } from 'lucide-react';
import { useId } from 'react';
import styles from './Toggle.module.css';

interface SwitchProps {
  checked: boolean;
  onChange(checked: boolean): void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** A labelled on/off switch row. The whole row is clickable. */
export function Switch({ checked, onChange, label, description, disabled }: SwitchProps): React.JSX.Element {
  const id = useId();
  return (
    <div className={styles.row} onClick={() => !disabled && onChange(!checked)}>
      <span className={styles.text}>
        <span className={styles.label} id={`${id}-label`}>
          {label}
        </span>
        {description && <span className={styles.description}>{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        className={styles.switch}
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onChange(!checked);
        }}
      />
    </div>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange(checked: boolean): void;
  label: string;
}

export function Checkbox({ checked, onChange, label }: CheckboxProps): React.JSX.Element {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className={styles.box} aria-hidden="true">
        <Check size={12} strokeWidth={3} />
      </span>
      {label}
    </label>
  );
}
