import { Bookmark, Trash } from 'lucide-react';
import { useState } from 'react';
import type { AnyOperation, OptionValues } from '@shared/operations/types';
import { normalizeOptions } from '@shared/operations/schema';
import { useSettings } from '../../state/settings';
import { Button, IconButton } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { Popover } from '../ui/Popover';
import { TextInput } from '../ui/TextInput';
import { useI18n } from '../../state/i18n';
import styles from './Options.module.css';

interface PresetBarProps {
  operation: AnyOperation;
  options: OptionValues;
  onApply(options: OptionValues): void;
  onReset(): void;
}

/** Save the current options as a named preset and re-apply saved presets. */
export function PresetBar({ operation, options, onApply, onReset }: PresetBarProps): React.JSX.Element {
  const { presetsFor, savePreset, deletePreset } = useSettings();
  const { t, locale } = useI18n();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const presets = presetsFor(operation.id);

  const submit = async (): Promise<void> => {
    if (name.trim() === '') return;
    if (await savePreset(operation.id, name, options)) {
      setSaving(false);
      setName('');
    }
  };

  return (
    <div className={styles.presets}>
      <Popover
        label={t('Presets')}
        width={260}
        trigger={({ ref, toggle, open }) => (
          <Button ref={ref} size="sm" variant="ghost" icon="Bookmark" iconRight="ChevronDown" aria-expanded={open} onClick={toggle}>
            {t('Presets')}
            {presets.length > 0 ? ` (${presets.length})` : ''}
          </Button>
        )}
      >
        {(close) => (
          <div className={styles.menu} role="menu">
            {presets.length === 0 && (
              <p className={styles.menuEmpty}>{t('No saved presets for {operation} yet.', { operation: t(operation.label) })}</p>
            )}
            {presets.map((preset) => (
              <div key={preset.id} className={styles.menuItem} role="menuitem">
                <Bookmark size={14} />
                <button
                  type="button"
                  className={styles.menuItemName}
                  style={{ textAlign: 'start' }}
                  onClick={() => {
                    onApply(normalizeOptions(operation, preset.options));
                    close();
                  }}
                >
                  {preset.name}
                </button>
                <IconButton
                  icon="Trash"
                  label={t('Delete preset {name}', { name: preset.name })}
                  tone="danger"
                  onClick={() => void deletePreset(preset.id)}
                />
              </div>
            ))}
            <div className={styles.menuDivider} />
            <button
              type="button"
              className={styles.menuItem}
              role="menuitem"
              onClick={() => {
                close();
                setSaving(true);
              }}
            >
              <Bookmark size={14} /> {t('Save current settings…')}
            </button>
            <button
              type="button"
              className={styles.menuItem}
              role="menuitem"
              onClick={() => {
                onReset();
                close();
              }}
            >
              <Trash size={14} /> {t('Reset to defaults')}
            </button>
          </div>
        )}
      </Popover>
      <Dialog
        open={saving}
        title={t('Save preset')}
        description={t('Store the current {operation} settings to reuse them later.', {
          operation: t(operation.label).toLocaleLowerCase(locale),
        })}
        onClose={() => setSaving(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaving(false)}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" disabled={name.trim() === ''} onClick={() => void submit()}>
              {t('Save preset')}
            </Button>
          </>
        }
      >
        <Field label={t('Preset name')} htmlFor="preset-name">
          <TextInput
            id="preset-name"
            value={name}
            maxLength={80}
            placeholder={t('e.g. Instagram square')}
            onChange={setName}
            onKeyDown={(event) => event.key === 'Enter' && void submit()}
          />
        </Field>
      </Dialog>
    </div>
  );
}
