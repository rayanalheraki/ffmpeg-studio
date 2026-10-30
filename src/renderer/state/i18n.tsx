import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { type Locale, type MessageParams, localeDirection, setLocale, translate, translatePlural } from '@shared/i18n';
import { useSettings } from './settings';

export interface I18n {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  /** Translates English source text, e.g. `t('Add files')` or `t('Start {jobs}', { jobs })`. */
  t(message: string, params?: MessageParams): string;
  /** Count-dependent `t`: `tp(n, '{count} file', '{count} files')`. */
  tp(count: number, one: string, other: string, params?: MessageParams): string;
}

function createI18n(locale: Locale): I18n {
  return {
    locale,
    dir: localeDirection(locale),
    t: (message, params) => translate(locale, message, params),
    tp: (count, one, other, params) => translatePlural(locale, count, one, other, params),
  };
}

const I18nContext = createContext<I18n>(createI18n('en'));

/** Follows the language setting: translates the UI and sets the document language and direction. */
export function I18nProvider({ children }: { children: ReactNode }): React.JSX.Element | null {
  const { settings, loaded } = useSettings();
  const locale = settings.language;
  // Shared code (validation, formatters) and callbacks translate through the module-level locale.
  setLocale(locale);
  const value = useMemo(() => createI18n(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = value.dir;
  }, [locale, value.dir]);

  // Wait for the saved language so the window never flashes English (or the wrong direction) first.
  if (!loaded) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
