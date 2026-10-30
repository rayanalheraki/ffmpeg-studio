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
        label="Presets"
        width={260}
        trigger={({ ref, toggle, open }) => (
          <Button ref={ref} size="sm" variant="ghost" icon="Bookmark" iconRight="ChevronDown" aria-expanded={open} onClick={toggle}>
            Presets{presets.length > 0 ? ` (${presets.length})` : ''}
          </Button>
        )}
      >
        {(close) => (
          <div className={styles.menu} role="menu">
            {presets.length === 0 && <p className={styles.menuEmpty}>No saved presets for {operation.label} yet.</p>}
            {presets.map((preset) => (
              <div key={preset.id} className={styles.menuItem} role="menuitem">
                <Bookmark size={14} />
                <button
                  type="button"
                  className={styles.menuItemName}
                  style={{ textAlign: 'left' }}
                  onClick={() => {
                    onApply(normalizeOptions(operation, preset.options));
                    close();
                  }}
                >
                  {preset.name}
                </button>
                <IconButton
                  icon="Trash"
                  label={`Delete preset ${preset.name}`}
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
              <Bookmark size={14} /> Save current settings…
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
              <Trash size={14} /> Reset to defaults
            </button>
          </div>
        )}
      </Popover>
      <Dialog
        open={saving}
        title="Save preset"
        description={`Store the current ${operation.label.toLowerCase()} settings to reuse them later.`}
        onClose={() => setSaving(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaving(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={name.trim() === ''} onClick={() => void submit()}>
              Save preset
            </Button>
          </>
        }
      >
        <Field label="Preset name" htmlFor="preset-name">
          <TextInput
            id="preset-name"
            value={name}
            maxLength={80}
            placeholder="e.g. Instagram square"
            onChange={setName}
            onKeyDown={(event) => event.key === 'Enter' && void submit()}
          />
        </Field>
      </Dialog>
    </div>
  );
}
