import { TriangleAlert } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { isSlotVisible } from '@shared/jobs/plan';
import { getDefaultOptions, normalizeOptions } from '@shared/operations/schema';
import type { AnyOperation, OptionValues } from '@shared/operations/types';
import { DropZone } from '../components/files/DropZone';
import { ExtraSlot } from '../components/files/ExtraSlot';
import { FileList } from '../components/files/FileList';
import { AdvancedPanel } from '../components/options/AdvancedPanel';
import { OptionsForm } from '../components/options/OptionsForm';
import { OutputSettings } from '../components/options/OutputSettings';
import { PresetBar } from '../components/options/PresetBar';
import { Button } from '../components/ui/Button';
import { Collapsible } from '../components/ui/Collapsible';
import { useAddFiles } from '../hooks/useAddFiles';
import { useBatchPreview } from '../hooks/useBatchPreview';
import { useFileDrop } from '../hooks/useFileDrop';
import { useHotkeys } from '../hooks/useHotkeys';
import { useStartBatch } from '../hooks/useStartBatch';
import { MOD_KEY } from '../lib/api';
import { Icon } from '../lib/Icon';
import { useFiles } from '../state/files';
import { MAIN_SLOT, readyFiles } from '../state/files-reducer';
import { useSettings } from '../state/settings';
import { useI18n } from '../state/i18n';
import styles from './Page.module.css';

export function OperationPage({ operation }: { operation: AnyOperation }): React.JSX.Element {
  const { settings, setOperationOptions } = useSettings();
  const { slots, remove, move, clear } = useFiles();
  const [extraArgs, setExtraArgs] = useState('');
  const { t, tp, locale } = useI18n();

  const stored = settings.lastOptions[operation.id];
  const options = useMemo(() => normalizeOptions(operation, stored ?? {}), [operation, stored]);
  const setOptions = useCallback((next: OptionValues) => setOperationOptions(operation.id, next), [operation.id, setOperationOptions]);

  const preview = useBatchPreview(operation, options, extraArgs);
  const { start, starting } = useStartBatch(operation, options, extraArgs, preview);
  const { route, browse } = useAddFiles(operation, options);
  const { setZone: setPageZone } = useFileDrop(route);

  useHotkeys({ 'mod+o': () => browse(), 'mod+enter': () => void start() });

  const entries = slots[MAIN_SLOT] ?? [];
  const excluded = useMemo(() => new Map(preview.excluded.map(({ file, reason }) => [file.path, reason])), [preview.excluded]);
  const visibleSlots = (operation.extraSlots ?? []).filter((slot) => isSlotVisible(slot, options));
  const reference = readyFiles(entries)[0] ?? null;
  const jobLabel = tp(preview.jobCount, '{count} job', '{count} jobs');
  const skipped = preview.excluded.length + preview.unsupported.length;

  return (
    <div className={styles.page} ref={setPageZone}>
      <div className={styles.scroll}>
        <header className={styles.header}>
          <span className={styles.headerIcon}>
            <Icon name={operation.icon} size={20} />
          </span>
          <div className={styles.headerText}>
            <h1 className={styles.title}>{t(operation.label)}</h1>
            <p className={styles.description}>{t(operation.description)}</p>
          </div>
          <PresetBar
            operation={operation}
            options={options}
            onApply={setOptions}
            onReset={() => setOptions(getDefaultOptions(operation))}
          />
        </header>

        <div className={styles.columns}>
          <div className={styles.column}>
            {entries.length === 0 ? (
              <DropZone
                accept={operation.input.accept}
                label={
                  operation.input.label ? t('Drop {name} here', { name: t(operation.input.label).toLocaleLowerCase(locale) }) : undefined
                }
                onFiles={route}
                onBrowse={() => browse()}
              />
            ) : (
              <>
                <DropZone compact accept={operation.input.accept} onFiles={route} onBrowse={() => browse()} />
                <FileList
                  operation={operation}
                  entries={entries}
                  excluded={excluded}
                  onRemove={(key) => remove(MAIN_SLOT, key)}
                  onMove={(from, to) => move(MAIN_SLOT, from, to)}
                  onClear={() => clear(MAIN_SLOT)}
                  onBrowse={() => browse()}
                />
              </>
            )}
            {visibleSlots.map((slot) => (
              <ExtraSlot key={slot.id} slot={slot} options={options} onBrowse={browse} />
            ))}
          </div>

          <div className={`${styles.column} ${styles.optionsColumn}`}>
            <section className={styles.card} aria-label={t('Settings')}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>{t('Settings')}</h2>
              </div>
              <OptionsForm operation={operation} options={options} reference={reference} onChange={setOptions} />
            </section>
            <Collapsible
              title={t('Output')}
              icon="FolderOutput"
              summary={settings.output.directory ? t('Custom folder') : t('Next to source')}
            >
              <OutputSettings examplePath={preview.outputPath} />
            </Collapsible>
            <Collapsible
              title={t('Advanced')}
              icon="SquareTerminal"
              summary={extraArgs ? t('Extra arguments set') : t('Command & arguments')}
            >
              <AdvancedPanel command={preview.command} extraArgs={extraArgs} onExtraArgsChange={setExtraArgs} />
            </Collapsible>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerText}>
          <span className={styles.summary}>
            {entries.length === 0 ? t('No files yet') : `${tp(entries.length, '{count} file', '{count} files')} · ${jobLabel}`}
          </span>
          {preview.problem ? (
            <span className={styles.problem} title={preview.problem}>
              <TriangleAlert size={13} /> {preview.problem}
            </span>
          ) : (
            <span className={styles.muted}>
              {skipped > 0 ? tp(skipped, '{count} file will be skipped', '{count} files will be skipped') : t('Ready when you are')}
            </span>
          )}
        </div>
        <Button
          variant="primary"
          size="lg"
          icon="Play"
          kbd={`${MOD_KEY} ↵`}
          loading={starting}
          disabled={preview.problem != null}
          onClick={() => void start()}
        >
          {preview.jobCount > 1 ? t('Start {jobs}', { jobs: jobLabel }) : t('action|Start')}
        </Button>
      </footer>
    </div>
  );
}
