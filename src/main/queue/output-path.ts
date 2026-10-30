import { existsSync } from 'node:fs';
import { parse, join } from 'node:path';
import type { OverwriteBehavior } from '@shared/types/jobs';

export interface ResolvedOutput {
  path: string;
  /** Set when the job must be skipped because the file exists. */
  skipReason: string | null;
}

/**
 * Applies the overwrite behavior to a planned output path. `reserved` holds
 * outputs of other pending jobs (lower-cased) so two jobs never share a file.
 */
export function resolveOutputPath(planned: string, behavior: OverwriteBehavior, reserved: Set<string>): ResolvedOutput {
  const taken = (candidate: string): boolean => reserved.has(candidate.toLowerCase()) || existsSync(candidate);
  const isPattern = planned.includes('%0');

  if (isPattern || !taken(planned)) return { path: planned, skipReason: null };
  if (behavior === 'overwrite' && !reserved.has(planned.toLowerCase())) return { path: planned, skipReason: null };
  if (behavior === 'skip') return { path: planned, skipReason: 'Skipped because the output file already exists.' };

  const { dir, name, ext } = parse(planned);
  for (let n = 1; n < 10_000; n += 1) {
    const candidate = join(dir, `${name} (${n})${ext}`);
    if (!taken(candidate)) return { path: candidate, skipReason: null };
  }
  return { path: planned, skipReason: 'Skipped because no free output file name was found.' };
}
