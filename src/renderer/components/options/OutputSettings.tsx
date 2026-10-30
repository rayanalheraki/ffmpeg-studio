import { Folder } from 'lucide-react';
import { useId } from 'react';
import { NAMING_TOKENS } from '@shared/jobs/output';
import { basename } from '@shared/utils/path';
import { errorMessage, studio } from '../../lib/api';
import { useSettings } from '../../state/settings';
import { useToasts } from '../../state/toasts';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { SegmentedControl } from '../ui/SegmentedControl';
import { TextInput } from '../ui/TextInput';
import styles from './Options.module.css';

/** Output folder, naming pattern and overwrite behavior, shared by all operations. */
export function OutputSettings({ examplePath }: { examplePath: string | null }): React.JSX.Element {
  const { settings, update } = useSettings();
  const { show } = useToasts();
  const patternId = useId();
  const { output } = settings;

  const chooseFolder = (): void => {
    studio.dialog
      .selectFolder(output.directory ?? settings.lastOutputDirectory)
      .then((directory) => {
        if (directory) update({ output: { ...output, directory }, lastOutputDirectory: directory });
      })
      .catch((error: unknown) => show('error', 'Could not open the folder picker', errorMessage(error)));
  };

  return (
    <div className={styles.stack}>
      <Field label="Output folder">
        <div className={styles.folderRow}>
          <div className={styles.folderPath} title={output.directory ?? 'Next to each source file'}>
            <Folder size={14} style={{ flexShrink: 0 }} />
            <span>{output.directory ?? 'Same folder as each source file'}</span>
          </div>
          <Button size="md" onClick={chooseFolder}>
            Change
          </Button>
          {output.directory && (
            <Button size="md" variant="ghost" onClick={() => update({ output: { ...output, directory: null } })}>
              Reset
            </Button>
          )}
        </div>
      </Field>
      <Field label="File name" htmlFor={patternId}>
        <TextInput
          id={patternId}
          mono
          value={output.pattern}
          maxLength={200}
          onChange={(pattern) => update({ output: { ...output, pattern } })}
        />
        <div className={styles.tokens}>
          {NAMING_TOKENS.map(({ token, description }) => (
            <button
              key={token}
              type="button"
              className={styles.token}
              title={description}
              onClick={() => update({ output: { ...output, pattern: `${output.pattern}${token}` } })}
            >
              {token}
            </button>
          ))}
        </div>
        {examplePath && (
          <p className={styles.example}>
            Example: <code>{basename(examplePath)}</code>
          </p>
        )}
      </Field>
      <Field label="If the file already exists">
        <SegmentedControl
          aria-label="If the file already exists"
          value={output.overwrite}
          onChange={(overwrite) => update({ output: { ...output, overwrite: overwrite as typeof output.overwrite } })}
          choices={[
            { value: 'rename', label: 'Keep both', hint: 'Adds a number, e.g. clip_converted (1).mp4' },
            { value: 'overwrite', label: 'Replace', hint: 'Overwrites the existing file' },
            { value: 'skip', label: 'Skip', hint: 'Leaves the existing file and skips the job' },
          ]}
        />
      </Field>
    </div>
  );
}
