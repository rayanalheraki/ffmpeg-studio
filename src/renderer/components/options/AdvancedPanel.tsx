import { useId } from 'react';
import { splitArgs } from '@shared/jobs/command';
import { errorMessage } from '../../lib/api';
import { useToasts } from '../../state/toasts';
import { IconButton } from '../ui/Button';
import { Field } from '../ui/Field';
import { TextInput } from '../ui/TextInput';
import styles from './Options.module.css';

interface AdvancedPanelProps {
  command: string | null;
  extraArgs: string;
  onExtraArgsChange(value: string): void;
}

/** Shows the exact command for the first job and lets experts append arguments. */
export function AdvancedPanel({ command, extraArgs, onExtraArgsChange }: AdvancedPanelProps): React.JSX.Element {
  const { show } = useToasts();
  const id = useId();
  const parsed = splitArgs(extraArgs);

  const copy = (): void => {
    if (!command) return;
    navigator.clipboard
      .writeText(command)
      .then(() => show('success', 'Command copied to the clipboard'))
      .catch((error: unknown) => show('error', 'Could not copy', errorMessage(error)));
  };

  const [binary, ...rest] = command?.split(' ') ?? [];

  return (
    <div className={styles.stack}>
      <Field label="Generated command" description="For the first file in the batch. Every job gets its own input and output paths.">
        <div className={styles.command}>
          {command ? (
            <>
              <pre className={styles.commandText}>
                <span className={styles.binary}>{binary}</span> {rest.join(' ')}
              </pre>
              <IconButton className={styles.copy} icon="Copy" label="Copy command" onClick={copy} />
            </>
          ) : (
            <p className={styles.placeholder}>Add files to see the exact FFmpeg command.</p>
          )}
        </div>
      </Field>
      <Field
        label="Extra arguments"
        htmlFor={id}
        error={parsed.error}
        description='Inserted right before the output file, e.g. -threads 4 -metadata comment="Made with FFmpeg Studio"'
      >
        <TextInput id={id} mono value={extraArgs} placeholder="-threads 4" invalid={parsed.error != null} onChange={onExtraArgsChange} />
      </Field>
    </div>
  );
}
