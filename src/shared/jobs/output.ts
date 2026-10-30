import type { OutputSettings } from '../types/jobs';
import type { AnyOperation, JobInputs, OptionValues } from '../operations/types';
import { dirname, joinPath } from '../utils/path';

export const DEFAULT_NAMING_PATTERN = '{name}_{op}';

export const NAMING_TOKENS: readonly { token: string; description: string }[] = [
  { token: '{name}', description: 'Source file name without extension' },
  { token: '{op}', description: 'Short operation label, e.g. converted' },
  { token: '{ext}', description: 'Source file extension' },
  { token: '{index}', description: 'Position of the file in the batch (1, 2, 3…)' },
  { token: '{date}', description: 'Today’s date, e.g. 2024-05-01' },
];

/** Characters that are invalid in file names on at least one desktop platform. */
// eslint-disable-next-line no-control-regex -- control characters are invalid in file names and must be matched.
const INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export interface NameTokens {
  name: string;
  op: string;
  ext: string;
  index: number;
  date: Date;
}

function isoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Expands a naming pattern into a safe base file name (without extension). */
export function renderFileName(pattern: string, tokens: NameTokens): string {
  const expanded = (pattern.trim() || DEFAULT_NAMING_PATTERN)
    .replaceAll('{name}', tokens.name)
    .replaceAll('{op}', tokens.op)
    .replaceAll('{ext}', tokens.ext)
    .replaceAll('{index}', String(tokens.index))
    .replaceAll('{date}', isoDate(tokens.date));
  const safe = expanded
    .replace(INVALID_CHARS, '_')
    .replace(/[. ]+$/, '')
    .trim();
  return safe || `${tokens.name}_${tokens.op}`;
}

export function operationSuffix(operation: AnyOperation, options: OptionValues): string {
  return typeof operation.outputSuffix === 'function' ? operation.outputSuffix(options) : operation.outputSuffix;
}

/**
 * Computes the intended output path for a job. Collision handling (rename or
 * skip) happens later in the main process, where the file system is available.
 */
export function plannedOutputPath(
  operation: AnyOperation,
  options: OptionValues,
  inputs: JobInputs,
  output: OutputSettings,
  index: number,
  now: Date = new Date(),
): string {
  const primary = inputs.main[0];
  if (!primary) throw new Error('Cannot name the output of a job without input files.');

  const directory = output.directory ?? dirname(primary.path);
  let base = renderFileName(output.pattern, {
    name: primary.name,
    op: operationSuffix(operation, options),
    ext: primary.ext,
    index: index + 1,
    date: now,
  });
  const extension = operation.outputExtension(options, primary);
  const sequence = operation.outputSequence?.(options) ?? false;
  if (sequence) base = `${base.replaceAll('%', '%%')}_%04d`;

  const candidate = joinPath(directory, `${base}.${extension}`);
  const collidesWithInput = [...inputs.main, ...Object.values(inputs.extra).flat()].some(
    (file) => file.path.toLowerCase() === candidate.toLowerCase(),
  );
  return collidesWithInput ? joinPath(directory, `${base}_output.${extension}`) : candidate;
}
