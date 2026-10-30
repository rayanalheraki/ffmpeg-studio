import { MAX_CONCURRENCY, MIN_CONCURRENCY } from '@shared/constants';
import { useSettings } from '../../state/settings';
import { Field } from '../ui/Field';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Checkbox } from '../ui/Switch';
import { LOCALES, isLocale } from '@shared/i18n';
import { useI18n } from '../../state/i18n';
import { Select } from '../ui/Select';
import styles from './TitleBar.module.css';

/** Quick preferences shown from the title bar. */
export function SettingsPanel(): React.JSX.Element {
  const { settings, environment, update } = useSettings();
  const { t } = useI18n();
  return (
    <div className={styles.settings}>
      <p className={styles.settingsTitle}>{t('Preferences')}</p>
      <Field label={t('Language')} htmlFor="settings-language">
        <Select
          id="settings-language"
          value={settings.language}
          choices={LOCALES.map((locale) => ({ value: locale.id, label: locale.name }))}
          onChange={(language) => isLocale(language) && update({ language })}
        />
      </Field>
      <Field label={t('Appearance')}>
        <SegmentedControl
          aria-label={t('Appearance')}
          value={settings.theme}
          showHint={false}
          onChange={(theme) => update({ theme: theme as typeof settings.theme })}
          choices={[
            { value: 'system', label: t('theme|System') },
            { value: 'light', label: t('theme|Light') },
            { value: 'dark', label: t('theme|Dark') },
          ]}
        />
      </Field>
      <Field
        label={t('Jobs at the same time')}
        aside={settings.concurrency}
        description={t('More parallel jobs finish batches faster but use more CPU.')}
      >
        <Slider
          aria-label={t('Jobs at the same time')}
          value={settings.concurrency}
          min={MIN_CONCURRENCY}
          max={MAX_CONCURRENCY}
          step={1}
          onChange={(concurrency) => update({ concurrency })}
        />
      </Field>
      <Checkbox
        label={t('Notify me when a batch finishes')}
        checked={settings.notifyOnFinish}
        onChange={(notifyOnFinish) => update({ notifyOnFinish })}
      />
      <p className={styles.about}>
        {t('FFmpeg {ffmpeg} · App {app}', { ffmpeg: environment.ffmpegVersion ?? t('not detected'), app: environment.version || 'dev' })}
      </p>
    </div>
  );
}
