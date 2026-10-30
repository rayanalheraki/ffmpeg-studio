import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOGS, LOCALES, formatList, translate, translatePlural } from '@shared/i18n';
import { CATEGORIES, OPERATIONS } from '@shared/operations/registry';

const SRC = join(__dirname, '../../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'locales' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const STRING = String.raw`'((?:[^'\\]|\\.)*)'`;
const unescape = (text: string): string => text.replace(/\\(.)/g, '$1');

/** Every English string passed to `t`, `msg` or `tp` in the source, plus the `other` forms of plurals. */
function collectSourceMessages(): { messages: Set<string>; plurals: Set<string> } {
  const messages = new Set<string>();
  const plurals = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    const code = readFileSync(file, 'utf8');
    for (const match of code.matchAll(new RegExp(String.raw`\b(?:t|msg)\(\s*${STRING}`, 'g'))) messages.add(unescape(match[1] ?? ''));
    for (const match of code.matchAll(new RegExp(String.raw`\btp\(\s*[^,']+,\s*${STRING},\s*${STRING}`, 'g'))) {
      plurals.add(unescape(match[2] ?? ''));
    }
  }
  return { messages, plurals };
}

/** Texts declared by operation definitions, which the UI passes through `t` at render time. */
function collectOperationMessages(): Set<string> {
  const out = new Set<string>(CATEGORIES.map((category) => category.label));
  const add = (text?: string): void => {
    if (text) out.add(text);
  };
  for (const op of OPERATIONS) {
    [op.label, op.description, op.input.label].forEach(add);
    for (const slot of op.extraSlots ?? []) [slot.label, slot.description].forEach(add);
    for (const field of op.options) {
      [field.label, field.description].forEach(add);
      if ('placeholder' in field) add(field.placeholder);
      if ('unit' in field) add(field.unit);
      if ('choices' in field) for (const choice of field.choices) [choice.label, choice.hint].forEach(add);
    }
  }
  return out;
}

/** Codec names, units and numbers read the same in every language and may be left out of catalogs. */
function needsTranslation(text: string): boolean {
  return /[a-z]{2,}/.test(text.replace(/\b(kbps|fps|px|pt|dB|LUFS|CRF|EBU|WebP|WebM|AAC|Hz)\b/g, ''));
}

const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();

const source = collectSourceMessages();
const operations = collectOperationMessages();
const all = new Set([...source.messages, ...source.plurals, ...operations]);

describe('translations', () => {
  it('finds the strings it checks', () => {
    expect(source.messages.size).toBeGreaterThan(150);
    expect(source.plurals.size).toBeGreaterThan(5);
    expect(operations.size).toBeGreaterThan(300);
  });

  for (const { id } of LOCALES.filter((locale) => locale.id !== 'en')) {
    const catalog = CATALOGS[id];

    it(`${id}: translates every user-facing string`, () => {
      const missing = [...all].filter((text) => needsTranslation(text) && catalog[text] === undefined);
      expect(missing).toEqual([]);
    });

    it(`${id}: has no entries for strings the app no longer uses`, () => {
      expect(Object.keys(catalog).filter((key) => !all.has(key))).toEqual([]);
    });

    it(`${id}: keeps the placeholders of the English text`, () => {
      for (const [key, value] of Object.entries(catalog)) {
        const forms = typeof value === 'string' ? [value] : Object.values(value);
        const allowed = new Set([...placeholders(key), ...(source.plurals.has(key) ? ['count'] : [])]);
        for (const form of forms) {
          for (const name of placeholders(form)) expect(allowed.has(name), `${key} → ${form}`).toBe(true);
        }
      }
    });
  }

  it('falls back to English and interpolates parameters', () => {
    expect(translate('ar', 'A string that has no translation {x}', { x: 1 })).toBe('A string that has no translation 1');
    expect(translate('en', 'Start {jobs}', { jobs: '3 jobs' })).toBe('Start 3 jobs');
    expect(translate('tr', 'Add files')).not.toBe('Add files');
  });

  it('picks plural forms with the rules of each language', () => {
    expect(translatePlural('en', 1, '{count} file', '{count} files')).toBe('1 file');
    expect(translatePlural('en', 3, '{count} file', '{count} files')).toBe('3 files');
    const arabic = new Set([0, 1, 2, 3, 11, 100].map((n) => translatePlural('ar', n, '{count} file', '{count} files')));
    expect(arabic.size).toBeGreaterThan(2);
  });

  it('formats lists for each language', () => {
    expect(formatList(['video', 'audio'], 'disjunction', 'en')).toBe('video or audio');
    expect(formatList(['video', 'ses'], 'disjunction', 'tr')).toBe('video veya ses');
  });
});
