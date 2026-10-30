import { Pipette } from 'lucide-react';
import { useDraft } from '../../hooks/useDraft';
import { TextInput } from './TextInput';
import { useI18n } from '../../state/i18n';
import styles from './Pickers.module.css';

const PRESETS = ['#ffffff', '#000000', '#f5b544', '#f2626b', '#3dd68c', '#5eb4ff', '#7d6dff'];

interface ColorInputProps {
  id?: string;
  value: string;
  onChange(value: string): void;
}

/** Swatch palette, a custom color picker and a hex field. */
export function ColorInput({ id, value, onChange }: ColorInputProps): React.JSX.Element {
  const [draft, setDraft] = useDraft(value, (v) => v);
  const { t } = useI18n();
  return (
    <div className={styles.color} role="radiogroup" aria-label={t('Color')}>
      {PRESETS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === color}
          aria-label={color}
          className={styles.swatch}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
      <label className={`${styles.swatch} ${styles.customSwatch}`} title={t('Pick a custom color')}>
        <Pipette size={12} strokeWidth={2.25} aria-hidden="true" />
        <input type="color" value={value} aria-label={t('Custom color')} onChange={(event) => onChange(event.target.value)} />
      </label>
      <TextInput
        id={id}
        mono
        className={styles.hex}
        value={draft}
        maxLength={7}
        invalid={!/^#[0-9a-fA-F]{6}$/.test(draft)}
        onChange={(next) => {
          setDraft(next);
          if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next.toLowerCase());
        }}
        onBlur={() => setDraft(value)}
      />
    </div>
  );
}
