import type { AnyOperation, Anchor, Dimensions, FieldSchema, OptionValue, OptionValues } from './types';

const ANCHORS: readonly Anchor[] = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];

export function getDefaultOptions(operation: AnyOperation): OptionValues {
  const values: OptionValues = {};
  for (const field of operation.options) {
    values[field.key] = field.type === 'dimensions' ? { ...field.default } : field.default;
  }
  return values;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isDimensions(value: unknown): value is Dimensions {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.width === 'number' && typeof record.height === 'number' && typeof record.lockAspect === 'boolean';
}

/** Coerces one untrusted value to the field's type, falling back to the default. */
function normalizeField(field: FieldSchema, raw: unknown): OptionValue {
  switch (field.type) {
    case 'select':
    case 'segmented':
      return typeof raw === 'string' && field.choices.some((choice) => choice.value === raw) ? raw : field.default;
    case 'slider':
    case 'number': {
      const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
      return Number.isFinite(value) ? clamp(value, field.min, field.max) : field.default;
    }
    case 'toggle':
      return typeof raw === 'boolean' ? raw : field.default;
    case 'text':
    case 'time': {
      if (typeof raw !== 'string') return field.default;
      const maxLength = field.type === 'text' ? (field.maxLength ?? 1000) : 32;
      return raw.slice(0, maxLength);
    }
    case 'color':
      return typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : field.default;
    case 'anchor':
      return typeof raw === 'string' && (ANCHORS as readonly string[]).includes(raw) ? raw : field.default;
    case 'dimensions':
      return isDimensions(raw)
        ? {
            width: Math.round(clamp(raw.width, field.min, field.max)),
            height: Math.round(clamp(raw.height, field.min, field.max)),
            lockAspect: raw.lockAspect,
          }
        : { ...field.default };
  }
}

/**
 * Returns a complete, valid option set for an operation. Unknown keys are
 * dropped and invalid values replaced by defaults, so options coming from the
 * renderer, presets or old settings can never produce malformed arguments.
 */
export function normalizeOptions(operation: AnyOperation, raw: unknown): OptionValues {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const values: OptionValues = {};
  for (const field of operation.options) values[field.key] = normalizeField(field, source[field.key]);
  return values;
}

export function isFieldVisible(field: FieldSchema, options: OptionValues): boolean {
  return field.visibleWhen ? field.visibleWhen(options) : true;
}
