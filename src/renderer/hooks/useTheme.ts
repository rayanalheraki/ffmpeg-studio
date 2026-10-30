import { useEffect, useState } from 'react';
import type { ThemePreference } from '@shared/types/settings';
import { studio } from '../lib/api';

const prefersDark = (): boolean => window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Applies the effective theme to `<html data-theme>` and follows the OS when set to `system`. */
export function useTheme(preference: ThemePreference): 'light' | 'dark' {
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    const unsubscribe = studio.app.onSystemThemeChange(setSystemDark);
    return () => {
      query.removeEventListener('change', onChange);
      unsubscribe();
    };
  }, []);

  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return theme;
}
