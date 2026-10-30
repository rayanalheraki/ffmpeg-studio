import type { icons } from 'lucide-react';
import type { MediaFile, MediaKind } from '../types/media';

/** Any lucide-react icon name, e.g. `'Film'` or `'Scissors'`. */
export type IconName = keyof typeof icons;

export type OperationCategory = 'convert' | 'edit' | 'audio' | 'effects' | 'tools';

export interface Dimensions {
  width: number;
  height: number;
  lockAspect: boolean;
}

export type Anchor = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';

export type OptionValue = string | number | boolean | Dimensions;
export type OptionValues = Record<string, OptionValue>;

export interface Choice {
  value: string;
  label: string;
  hint?: string;
}

interface FieldBase<O> {
  key: Extract<keyof O, string>;
  label: string;
  description?: string;
  /** Hide the field unless this returns true for the current options. */
  visibleWhen?: (options: O) => boolean;
  /** Layout hint for the generated form. Defaults to `'full'`. */
  span?: 'full' | 'half';
}

export interface SelectField<O> extends FieldBase<O> {
  type: 'select';
  choices: Choice[];
  default: string;
}

export interface SegmentedField<O> extends FieldBase<O> {
  type: 'segmented';
  choices: Choice[];
  default: string;
}

export interface SliderField<O> extends FieldBase<O> {
  type: 'slider';
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
  /** Number of decimals shown next to the slider. */
  precision?: number;
}

export interface NumberField<O> extends FieldBase<O> {
  type: 'number';
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface ToggleField<O> extends FieldBase<O> {
  type: 'toggle';
  default: boolean;
}

export interface TextField<O> extends FieldBase<O> {
  type: 'text';
  default: string;
  placeholder?: string;
  maxLength?: number;
}

/** Timestamp input accepting `HH:MM:SS(.mmm)`, `MM:SS` or seconds. Empty means "not set". */
export interface TimeField<O> extends FieldBase<O> {
  type: 'time';
  default: string;
  placeholder?: string;
}

export interface ColorField<O> extends FieldBase<O> {
  type: 'color';
  /** Hex color, `#rrggbb`. */
  default: string;
}

export interface AnchorField<O> extends FieldBase<O> {
  type: 'anchor';
  default: Anchor;
}

export interface DimensionsField<O> extends FieldBase<O> {
  type: 'dimensions';
  default: Dimensions;
  min: number;
  max: number;
}

export type FieldSchema<O = OptionValues> =
  | SelectField<O>
  | SegmentedField<O>
  | SliderField<O>
  | NumberField<O>
  | ToggleField<O>
  | TextField<O>
  | TimeField<O>
  | ColorField<O>
  | AnchorField<O>
  | DimensionsField<O>;

export type FieldType = FieldSchema['type'];

/** Files assigned to a single job, grouped by input slot. */
export interface JobInputs {
  main: MediaFile[];
  extra: Record<string, MediaFile[]>;
}

export interface BuildContext {
  /** Absolute output path (may contain `%04d` for image sequences). */
  output: string;
  /** System font for text filters, or null when none is available. */
  fontFile: string | null;
}

/**
 * A secondary input slot, e.g. the watermark image or the replacement audio.
 *
 * - `all`: every job receives every file in the slot (e.g. several subtitle tracks).
 * - `paired`: job N receives file N; a single file is shared by all jobs.
 */
export interface ExtraSlot<O = OptionValues> {
  id: string;
  label: string;
  description?: string;
  accept: MediaKind[];
  multiple: boolean;
  distribution: 'all' | 'paired';
  /** Whether at least one file is required. Defaults to always required. */
  requiredWhen?: (options: O) => boolean;
  visibleWhen?: (options: O) => boolean;
}

export interface OperationDefinition<O extends OptionValues = OptionValues> {
  /** Stable, kebab-case identifier. Used in settings and presets. */
  id: string;
  label: string;
  description: string;
  category: OperationCategory;
  icon: IconName;
  /** Sort order inside the category. */
  order: number;
  /** `inspect` operations show information instead of creating jobs. */
  mode?: 'job' | 'inspect';
  /** `perFile`: one job per primary file. `combine`: one job using every primary file. */
  batch: 'perFile' | 'combine';
  input: {
    accept: MediaKind[];
    /** Minimum number of primary files (default 1). */
    minFiles?: number;
    label?: string;
  };
  extraSlots?: ExtraSlot<O>[];
  options: FieldSchema<O>[];
  /** Value of the `{op}` naming token, e.g. `converted`. */
  outputSuffix: string | ((options: O) => string);
  /** Output file extension without the dot. */
  outputExtension: (options: O, primary: MediaFile) => string;
  /** When true the output is an image sequence and receives a `_%04d` suffix. */
  outputSequence?: (options: O) => boolean;
  /** Expected output duration in seconds, used for progress. Defaults to the input duration. */
  expectedDuration?: (options: O, inputs: JobInputs) => number | null;
  /** Returns a user-facing error message when the job cannot run. */
  validate?: (options: O, inputs: JobInputs) => string | null;
  /**
   * Pure function returning FFmpeg arguments, without the binary name and
   * without global flags. The output path MUST be the last argument.
   */
  buildArgs: (options: O, inputs: JobInputs, ctx: BuildContext) => string[];
}

/** Type-erased definition as stored in the registry. */
export type AnyOperation = OperationDefinition<OptionValues>;

/**
 * Declares an operation with strongly-typed options while letting the
 * registry store every operation under one erased type.
 */
export function defineOperation<O extends OptionValues>(definition: OperationDefinition<O>): AnyOperation {
  return definition as unknown as AnyOperation;
}
