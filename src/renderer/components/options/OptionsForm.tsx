import type { AnyOperation, OptionValue, OptionValues } from '@shared/operations/types';
import { isFieldVisible } from '@shared/operations/schema';
import type { MediaFile } from '@shared/types/media';
import { cx } from '../../lib/cx';
import { FieldControl } from './FieldControl';
import styles from './Options.module.css';

interface OptionsFormProps {
  operation: AnyOperation;
  options: OptionValues;
  reference: MediaFile | null;
  onChange(options: OptionValues): void;
}

/** A form generated from the operation's declarative options schema. */
export function OptionsForm({ operation, options, reference, onChange }: OptionsFormProps): React.JSX.Element {
  const fields = operation.options.filter((field) => isFieldVisible(field, options));
  const set = (key: string, value: OptionValue): void => onChange({ ...options, [key]: value });

  if (fields.length === 0) return <p className={styles.noOptions}>This operation has no settings. Just press Start.</p>;

  return (
    <div className={styles.grid}>
      {fields.map((field) => (
        <div key={field.key} className={cx(styles.cell, field.span === 'half' && styles.half)}>
          <FieldControl
            field={field}
            value={options[field.key] ?? field.default}
            reference={reference}
            onChange={(value) => set(field.key, value)}
          />
        </div>
      ))}
    </div>
  );
}
