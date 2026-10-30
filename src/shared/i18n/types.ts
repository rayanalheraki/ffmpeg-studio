export type Locale = 'en' | 'ar' | 'tr';

/** One translation per CLDR plural category, e.g. Arabic uses zero/one/two/few/many/other. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/**
 * Translations keyed by their English source text. Missing keys fall back to
 * English, so a new string never shows up blank.
 */
export type Catalog = Readonly<Record<string, string | PluralForms>>;

export type MessageParams = Readonly<Record<string, string | number>>;
