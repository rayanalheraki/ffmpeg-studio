import { useId } from 'react';
import { splitArgs } from '@shared/jobs/command';
import { errorMessage } from '../../lib/api';
import { useToasts } from '../../state/toasts';
import { IconButton } from '../ui/Button';
import { Field } from '../ui/Field';
import { TextInput } from '../ui/TextInput';
import { useI18n } from '../../state/i18n';
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
  const { t } = useI18n();
  const parsed = splitArgs(extraArgs);

  const copy = (): void => {
    if (!command) return;
    navigator.clipboard
      .writeText(command)
      .then(() => show('success', t('Command copied to the clipboard')))
      .catch((error: unknown) => show('error', t('Could not copy'), errorMessage(error)));
  };

  const [binary, ...rest] = command?.split(' ') ?? [];

  return (
    <div className={styles.stack}>
      <Field
        label={t('Generated command')}
        description={t('For the first file in the batch. Every job gets its own input and output paths.')}
      >
        <div className={styles.command}>
          {command ? (
            <>
              <pre className={styles.commandText} dir="ltr">
                <span className={styles.binary}>{binary}</span> {rest.join(' ')}
              </pre>
              <IconButton className={styles.copy} icon="Copy" label={t('Copy command')} onClick={copy} />
            </>
          ) : (
            <p className={styles.placeholder}>{t('Add files to see the exact FFmpeg command.')}</p>
          )}
        </div>
      </Field>
      <Field
        label={t('Extra arguments')}
        htmlFor={id}
        error={parsed.error}
        description={t('Inserted right before the output file, e.g. {example}', {
          example: '-threads 4 -metadata comment="Made with FFmpeg Studio"',
        })}
      >
        <TextInput id={id} mono value={extraArgs} placeholder="-threads 4" invalid={parsed.error != null} onChange={onExtraArgsChange} />
      </Field>
    </div>
  );
}
