import type { ReactNode } from 'react';
import styles from './Input.module.css';

interface FieldProps {
  label: string;
  htmlFor?: string;
  description?: string;
  error?: string | null;
  /** Right-aligned content next to the label, e.g. the current slider value. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, description, error, aside, children, className }: FieldProps): React.JSX.Element {
  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
        </label>
        {aside != null && <span className={styles.aside}>{aside}</span>}
      </div>
      {children}
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : (
        description && <span className={styles.description}>{description}</span>
      )}
    </div>
  );
}
