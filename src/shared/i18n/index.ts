import ar from './locales/ar';
import tr from './locales/tr';
import type { Catalog, Locale, MessageParams } from './types';

export type { Catalog, Locale, MessageParams, PluralForms } from './types';

export interface LocaleInfo {
  id: Locale;
  /** Name of the language in that language, for the language picker. */
  name: string;
  dir: 'ltr' | 'rtl';
}

export const LOCALES: readonly LocaleInfo[] = [
  { id: 'en', name: 'English', dir: 'ltr' },
  { id: 'ar', name: 'العربية', dir: 'rtl' },
  { id: 'tr', name: 'Türkçe', dir: 'ltr' },
];

export const DEFAULT_LOCALE: Locale = 'en';

/** English is the source language, so its catalog is empty: every key is its own translation. */
export const CATALOGS: Readonly<Record<Locale, Catalog>> = { en: {}, ar, tr };

/**
 * A `context|` prefix tells apart identical English words that other languages
 * translate differently, e.g. `action|Start` (button) and `Start` (a time field).
 * It is never shown: English and missing translations display the text after it.
 */
const CONTEXT = /^[a-z]+\|/;

const pluralRules = new Map<Locale, Intl.PluralRules>();
let current: Locale = DEFAULT_LOCALE;

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale.id === value);
}

export function localeDirection(locale: Locale): 'ltr' | 'rtl' {
  return LOCALES.find((info) => info.id === locale)?.dir ?? 'ltr';
}

/** Sets the language used by `t` and `tp` in this process (main and renderer each keep their own). */
export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

function interpolate(text: string, params?: MessageParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

function pluralCategory(locale: Locale, count: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules.select(count);
}

/** Translates English source text into `locale`, replacing `{name}` placeholders with `params`. */
export function translate(locale: Locale, message: string, params?: MessageParams): string {
  const entry = CATALOGS[locale][message];
  const text = entry === undefined ? message.replace(CONTEXT, '') : typeof entry === 'string' ? entry : entry.other;
  return interpolate(text, params);
}

/**
 * Translates a message that depends on a count. The catalog key is the English
 * `other` form; `{count}` is always available as a placeholder.
 */
export function translatePlural(locale: Locale, count: number, one: string, other: string, params?: MessageParams): string {
  const values = { count, ...params };
  const entry = CATALOGS[locale][other];
  if (entry === undefined) return interpolate(count === 1 ? one : other, values);
  if (typeof entry === 'string') return interpolate(entry, values);
  return interpolate(entry[pluralCategory(locale, count)] ?? entry.other, values);
}

/**
 * Marks English source text for translation without translating it yet, for
 * labels declared in constants and translated later with `t(label)`.
 * The catalog test collects every `msg(...)`, `t(...)` and `tp(...)` literal.
 */
export function msg(message: string): string {
  return message;
}

/** Translates into the current language of this process. */
export function t(message: string, params?: MessageParams): string {
  return translate(current, message, params);
}

/** Count-dependent `t`, e.g. `tp(n, '{count} file', '{count} files')`. */
export function tp(count: number, one: string, other: string, params?: MessageParams): string {
  return translatePlural(current, count, one, other, params);
}

/** Joins items as a language-appropriate list: "a, b and c" or "a, b or c". */
export function formatList(items: readonly string[], type: 'conjunction' | 'disjunction' = 'conjunction', locale = current): string {
  return new Intl.ListFormat(locale, { type }).format(items);
}
