import { AudioWaveform, Copy, Minus, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ThemePreference } from '@shared/types/settings';
import { MOD_KEY, isMac, studio } from '../../lib/api';
import { cx } from '../../lib/cx';
import { useJobs } from '../../state/jobs';
import { useSettings } from '../../state/settings';
import { IconButton } from '../ui/Button';
import { Popover } from '../ui/Popover';
import { SettingsPanel } from './SettingsPanel';
import styles from './TitleBar.module.css';

const NEXT_THEME: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_ICON = { system: 'Monitor', light: 'Sun', dark: 'Moon' } as const;

export function TitleBar(): React.JSX.Element {
  const { settings, update } = useSettings();
  const { counts } = useJobs();
  const [maximized, setMaximized] = useState(false);
  const active = counts.running + counts.queued;

  useEffect(() => {
    void studio.window.isMaximized().then(setMaximized);
    return studio.window.onMaximizedChange(setMaximized);
  }, []);

  return (
    <header
      className={cx(styles.bar, isMac && styles.mac)}
      onDoubleClick={(event) => event.target === event.currentTarget && studio.window.toggleMaximize()}
    >
      <div className={cx(styles.brand, styles.noDrag)}>
        <span className={styles.mark} aria-hidden="true">
          <AudioWaveform size={13} strokeWidth={2.25} />
        </span>
        FFmpeg Studio
      </div>
      <IconButton
        className={styles.noDrag}
        icon={settings.sidebarCollapsed ? 'PanelLeftOpen' : 'PanelLeftClose'}
        label={`Toggle sidebar (${MOD_KEY}+B)`}
        onClick={() => update({ sidebarCollapsed: !settings.sidebarCollapsed })}
      />
      <div className={styles.spacer} />
      <div className={cx(styles.actions, styles.noDrag)}>
        <IconButton
          icon={THEME_ICON[settings.theme]}
          label={`Theme: ${settings.theme} (click to change)`}
          onClick={() => update({ theme: NEXT_THEME[settings.theme] })}
        />
        <Popover
          label="Preferences"
          trigger={({ ref, toggle, open }) => <IconButton ref={ref} icon="Settings2" label="Preferences" active={open} onClick={toggle} />}
        >
          <SettingsPanel />
        </Popover>
        <div className={styles.queueButton}>
          <IconButton
            icon={settings.queueOpen ? 'PanelRightClose' : 'PanelRightOpen'}
            label={`Toggle job queue (${MOD_KEY}+J)`}
            active={settings.queueOpen}
            onClick={() => update({ queueOpen: !settings.queueOpen })}
          />
          {active > 0 && <span className={styles.count}>{active}</span>}
        </div>
      </div>
      {!isMac && (
        <div className={cx(styles.windowControls, styles.noDrag)}>
          <button type="button" className={styles.windowButton} aria-label="Minimize" onClick={() => studio.window.minimize()}>
            <Minus size={15} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            className={styles.windowButton}
            aria-label={maximized ? 'Restore' : 'Maximize'}
            onClick={() => studio.window.toggleMaximize()}
          >
            {maximized ? <Copy size={13} strokeWidth={1.5} /> : <Square size={12} strokeWidth={1.5} />}
          </button>
          <button type="button" className={cx(styles.windowButton, styles.close)} aria-label="Close" onClick={() => studio.window.close()}>
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </header>
  );
}
