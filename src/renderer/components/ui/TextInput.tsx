import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Input.module.css';

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange(value: string): void;
  invalid?: boolean;
  mono?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { value, onChange, invalid = false, mono = false, leading, trailing, disabled, className, ...rest },
  ref,
) {
  return (
    <div className={cx(styles.control, invalid && styles.invalid, disabled && styles.disabled, className)}>
      {leading && <span className={styles.leading}>{leading}</span>}
      <input
        ref={ref}
        className={cx(styles.input, mono && styles.mono)}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        {...rest}
      />
      {trailing && <span className={styles.adornment}>{trailing}</span>}
    </div>
  );
});
