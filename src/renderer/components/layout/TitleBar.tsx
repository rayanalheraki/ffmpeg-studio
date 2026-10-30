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
import { msg } from '@shared/i18n';
import { useI18n } from '../../state/i18n';
import styles from './TitleBar.module.css';

const NEXT_THEME: Record<ThemePreference, ThemePreference> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_ICON = { system: 'Monitor', light: 'Sun', dark: 'Moon' } as const;
const THEME_LABEL: Record<ThemePreference, string> = { system: msg('theme|System'), light: msg('theme|Light'), dark: msg('theme|Dark') };

export function TitleBar(): React.JSX.Element {
  const { settings, update } = useSettings();
  const { counts } = useJobs();
  const { t, dir } = useI18n();
  // Panels swap sides in right-to-left layouts, so do their icons.
  const [start, end] = dir === 'rtl' ? (['Right', 'Left'] as const) : (['Left', 'Right'] as const);
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
        icon={settings.sidebarCollapsed ? `Panel${start}Open` : `Panel${start}Close`}
        label={t('Toggle sidebar ({shortcut})', { shortcut: `${MOD_KEY}+B` })}
        onClick={() => update({ sidebarCollapsed: !settings.sidebarCollapsed })}
      />
      <div className={styles.spacer} />
      <div className={cx(styles.actions, styles.noDrag)}>
        <IconButton
          icon={THEME_ICON[settings.theme]}
          label={t('Theme: {theme} (click to change)', { theme: t(THEME_LABEL[settings.theme]) })}
          onClick={() => update({ theme: NEXT_THEME[settings.theme] })}
        />
        <Popover
          label={t('Preferences')}
          trigger={({ ref, toggle, open }) => (
            <IconButton ref={ref} icon="Settings2" label={t('Preferences')} active={open} onClick={toggle} />
          )}
        >
          <SettingsPanel />
        </Popover>
        <div className={styles.queueButton}>
          <IconButton
            icon={settings.queueOpen ? `Panel${end}Close` : `Panel${end}Open`}
            label={t('Toggle job queue ({shortcut})', { shortcut: `${MOD_KEY}+J` })}
            active={settings.queueOpen}
            onClick={() => update({ queueOpen: !settings.queueOpen })}
          />
          {active > 0 && <span className={styles.count}>{active}</span>}
        </div>
      </div>
      {!isMac && (
        <div className={cx(styles.windowControls, styles.noDrag)}>
          <button type="button" className={styles.windowButton} aria-label={t('Minimize')} onClick={() => studio.window.minimize()}>
            <Minus size={15} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            className={styles.windowButton}
            aria-label={maximized ? t('Restore') : t('Maximize')}
            onClick={() => studio.window.toggleMaximize()}
          >
            {maximized ? <Copy size={13} strokeWidth={1.5} /> : <Square size={12} strokeWidth={1.5} />}
          </button>
          <button
            type="button"
            className={cx(styles.windowButton, styles.close)}
            aria-label={t('Close')}
            onClick={() => studio.window.close()}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </header>
  );
}
