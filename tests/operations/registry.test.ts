import { describe, expect, it } from 'vitest';
import { OPERATIONS, getOperation, operationsByCategory } from '@shared/operations/registry';
import { getDefaultOptions, normalizeOptions } from '@shared/operations/schema';
import type { AnyOperation, JobInputs } from '@shared/operations/types';
import { OUTPUT, audio, image, inputs, subtitle, video } from '../helpers';

/** A representative input set that satisfies every operation with its default options. */
function sampleInputs(operation: AnyOperation): JobInputs {
  const accept = operation.input.accept;
  const primary = accept.includes('video') ? video({ subtitleStreams: 1 }) : accept.includes('image') ? image() : audio();
  const main = operation.batch === 'combine' ? [primary, { ...primary, id: 'second', path: '/media/second.mp4' }] : [primary];
  const extra: JobInputs['extra'] = {};
  for (const slot of operation.extraSlots ?? []) {
    extra[slot.id] = slot.accept.includes('subtitle') ? [subtitle()] : slot.accept.includes('image') ? [image()] : [audio()];
  }
  return inputs(main, extra);
}

describe('operation registry', () => {
  it('registers all 23 operations with unique ids', () => {
    expect(OPERATIONS).toHaveLength(23);
    expect(new Set(OPERATIONS.map((operation) => operation.id)).size).toBe(OPERATIONS.length);
  });

  it('groups every operation under a known category', () => {
    const grouped = operationsByCategory().flatMap((group) => group.operations);
    expect(grouped).toHaveLength(OPERATIONS.length);
    expect(getOperation('does-not-exist')).toBeUndefined();
  });

  it('declares unique option keys for every operation', () => {
    for (const operation of OPERATIONS) {
      const keys = operation.options.map((field) => field.key);
      expect(new Set(keys).size, operation.id).toBe(keys.length);
    }
  });

  it('keeps default select values among the declared choices', () => {
    for (const operation of OPERATIONS) {
      for (const field of operation.options) {
        if (field.type === 'select' || field.type === 'segmented') {
          expect(
            field.choices.map((c) => c.value),
            `${operation.id}.${field.key}`,
          ).toContain(field.default);
        }
      }
    }
  });

  it('normalizes defaults to themselves', () => {
    for (const operation of OPERATIONS) {
      const defaults = getDefaultOptions(operation);
      expect(normalizeOptions(operation, defaults), operation.id).toEqual(defaults);
    }
  });

  describe.each(OPERATIONS.map((operation) => [operation.id, operation] as const))('%s', (_id, operation) => {
    const jobInputs = sampleInputs(operation);
    const defaults = getDefaultOptions(operation);

    it('builds well-formed arguments from default options', () => {
      // Some operations intentionally require a change from their defaults (e.g. video filters).
      if (operation.validate?.(defaults, jobInputs)) return;
      const args = operation.buildArgs(defaults, jobInputs, { output: OUTPUT, fontFile: '/fonts/Inter.ttf' });
      expect(args.length).toBeGreaterThan(1);
      expect(args.every((arg) => typeof arg === 'string' && arg !== '')).toBe(true);
      expect(args.join(' ')).not.toMatch(/undefined|NaN|\[object Object\]/);
      if (operation.mode !== 'inspect') expect(args).toContain('-i');
    });

    it('puts the output path last (job operations only)', () => {
      if (operation.mode === 'inspect') return;
      const args = operation.buildArgs(defaults, jobInputs, { output: OUTPUT, fontFile: null });
      expect(args.at(-1)).toBe(OUTPUT);
    });

    it('returns a plain output extension', () => {
      const primary = jobInputs.main[0];
      if (!primary) throw new Error('missing primary input');
      expect(operation.outputExtension(defaults, primary)).toMatch(/^[a-z0-9]+$/);
    });
  });
});
