import { randomUUID } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { t, tp } from '@shared/i18n';
import { assembleArgs, splitArgs } from '@shared/jobs/command';
import { plannedOutputPath } from '@shared/jobs/output';
import { planJobs } from '@shared/jobs/plan';
import { getOperation } from '@shared/operations/registry';
import { normalizeOptions } from '@shared/operations/schema';
import type { OutputSettings, OverwriteBehavior } from '@shared/types/jobs';
import type { MediaFile } from '@shared/types/media';
import { UserError } from '../log';
import type { JobSpec } from './job-queue';
import { resolveOutputPath } from './output-path';

export interface CreateJobsDeps {
  probe(paths: string[]): Promise<MediaFile[]>;
  fontFile: string | null;
  /** Outputs of pending jobs (lower-cased). Mutated as new outputs are reserved. */
  reserved: Set<string>;
}

const MAX_FILES = 5000;
const OVERWRITE: readonly OverwriteBehavior[] = ['overwrite', 'rename', 'skip'];

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_FILES || !value.every((item) => typeof item === 'string' && isAbsolute(item))) {
    throw new UserError(t('Invalid file list for {name}.', { name: label }));
  }
  return value as string[];
}

function parseOutput(value: unknown): OutputSettings {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const directory = typeof raw.directory === 'string' && raw.directory !== '' ? raw.directory : null;
  if (directory && !isAbsolute(directory)) throw new UserError(t('The output folder must be an absolute path.'));
  return {
    directory,
    pattern: typeof raw.pattern === 'string' ? raw.pattern.slice(0, 200) : '',
    overwrite: OVERWRITE.includes(raw.overwrite as OverwriteBehavior) ? (raw.overwrite as OverwriteBehavior) : 'rename',
  };
}

async function ensureDirectory(directory: string): Promise<void> {
  try {
    await mkdir(directory, { recursive: true });
    if (!(await stat(directory)).isDirectory()) throw new Error('not a directory');
  } catch {
    throw new UserError(t('The output folder "{directory}" cannot be created or is not a folder.', { directory }));
  }
}

/**
 * Validates an untrusted batch request from the renderer and turns it into
 * job specs. Arguments are always rebuilt here from the operation definition;
 * the renderer never supplies a raw command.
 */
export async function createJobs(request: unknown, deps: CreateJobsDeps): Promise<{ specs: JobSpec[]; warnings: string[] }> {
  const raw = (typeof request === 'object' && request !== null ? request : {}) as Record<string, unknown>;
  const operation = typeof raw.operationId === 'string' ? getOperation(raw.operationId) : undefined;
  if (!operation) throw new UserError(t('Unknown operation.'));
  if (operation.mode === 'inspect') throw new UserError(t('{operation} does not create output files.', { operation: t(operation.label) }));

  const options = normalizeOptions(operation, raw.options);
  const output = parseOutput(raw.output);
  const extraArgs = splitArgs(typeof raw.extraArgs === 'string' ? raw.extraArgs.slice(0, 4000) : '');
  if (extraArgs.error) throw new UserError(extraArgs.error);

  const mainFiles = await deps.probe(stringArray(raw.main, t('the input files')));
  const rawExtra = (typeof raw.extra === 'object' && raw.extra !== null ? raw.extra : {}) as Record<string, unknown>;
  const extra: Record<string, MediaFile[]> = {};
  for (const slot of operation.extraSlots ?? []) {
    extra[slot.id] = rawExtra[slot.id] === undefined ? [] : await deps.probe(stringArray(rawExtra[slot.id], t(slot.label)));
  }

  const plan = planJobs(operation, options, mainFiles, extra);
  if (plan.error) throw new UserError(plan.error);

  const warnings = plan.skipped.map(
    (file) => `${file.fileName}: ${file.probeError ?? t('Not supported by {operation}.', { operation: t(operation.label) })}`,
  );
  const batchId = randomUUID();
  const specs: JobSpec[] = [];

  for (const [index, inputs] of plan.jobs.entries()) {
    const primary = inputs.main[0];
    if (!primary) continue;
    const problem = operation.validate?.(options, inputs) ?? null;
    if (problem) {
      warnings.push(`${primary.fileName}: ${problem}`);
      continue;
    }

    const planned = plannedOutputPath(operation, options, inputs, output, index);
    const resolved = resolveOutputPath(planned, output.overwrite, deps.reserved);
    deps.reserved.add(resolved.path.toLowerCase());

    const operationArgs = operation.buildArgs(options, inputs, { output: resolved.path, fontFile: deps.fontFile });
    specs.push({
      id: randomUUID(),
      batchId,
      operationId: operation.id,
      operationLabel: operation.label,
      title:
        inputs.main.length > 1
          ? tp(inputs.main.length - 1, '{name} + {count} more', '{name} + {count} more', { name: primary.fileName })
          : primary.fileName,
      inputPaths: [...inputs.main, ...Object.values(inputs.extra).flat()].map((file) => file.path),
      outputPath: resolved.path,
      args: assembleArgs(operationArgs, extraArgs.args),
      expectedDuration: operation.expectedDuration?.(options, inputs) ?? primary.duration,
      isSequence: operation.outputSequence?.(options) ?? false,
      skipReason: resolved.skipReason,
    });
  }

  if (specs.length === 0) throw new UserError(warnings[0] ?? t('Nothing to process.'));
  if (output.directory) await ensureDirectory(output.directory);
  return { specs, warnings };
}
