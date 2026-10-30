import { MAX_CONCURRENCY, MIN_CONCURRENCY } from '@shared/constants';
import { useSettings } from '../../state/settings';
import { Field } from '../ui/Field';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Checkbox } from '../ui/Switch';
import styles from './TitleBar.module.css';

/** Quick preferences shown from the title bar. */
export function SettingsPanel(): React.JSX.Element {
  const { settings, environment, update } = useSettings();
  return (
    <div className={styles.settings}>
      <p className={styles.settingsTitle}>Preferences</p>
      <Field label="Appearance">
        <SegmentedControl
          aria-label="Appearance"
          value={settings.theme}
          showHint={false}
          onChange={(theme) => update({ theme: theme as typeof settings.theme })}
          choices={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Field>
      <Field
        label="Jobs at the same time"
        aside={settings.concurrency}
        description="More parallel jobs finish batches faster but use more CPU."
      >
        <Slider
          aria-label="Jobs at the same time"
          value={settings.concurrency}
          min={MIN_CONCURRENCY}
          max={MAX_CONCURRENCY}
          step={1}
          onChange={(concurrency) => update({ concurrency })}
        />
      </Field>
      <Checkbox
        label="Notify me when a batch finishes"
        checked={settings.notifyOnFinish}
        onChange={(notifyOnFinish) => update({ notifyOnFinish })}
      />
      <p className={styles.about}>
        FFmpeg {environment.ffmpegVersion ?? 'not detected'} · App {environment.version || 'dev'}
      </p>
    </div>
  );
}
