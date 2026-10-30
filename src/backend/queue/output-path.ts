import { t } from '@shared/i18n';
import type { OverwriteBehavior } from '@shared/types/jobs';
import { basename, dirname, joinPath, stripExtension } from '@shared/utils/path';

export interface ResolvedOutput {
  path: string;
  /** Set when the job must be skipped because the file exists. */
  skipReason: string | null;
}

/**
 * Applies the overwrite behavior to a planned output path. `reserved` holds
 * outputs of other pending jobs (lower-cased) so two jobs never share a file.
 */
export async function resolveOutputPath(
  planned: string,
  behavior: OverwriteBehavior,
  reserved: Set<string>,
  exists: (filePath: string) => Promise<boolean>,
): Promise<ResolvedOutput> {
  const taken = async (candidate: string): Promise<boolean> => reserved.has(candidate.toLowerCase()) || (await exists(candidate));
  const isPattern = planned.includes('%0');

  if (isPattern || !(await taken(planned))) return { path: planned, skipReason: null };
  if (behavior === 'overwrite' && !reserved.has(planned.toLowerCase())) return { path: planned, skipReason: null };
  if (behavior === 'skip') return { path: planned, skipReason: t('Skipped because the output file already exists.') };

  const dir = dirname(planned);
  const fileName = basename(planned);
  const name = stripExtension(fileName);
  const ext = fileName.slice(name.length);
  for (let n = 1; n < 10_000; n += 1) {
    const candidate = joinPath(dir, `${name} (${n})${ext}`);
    if (!(await taken(candidate))) return { path: candidate, skipReason: null };
  }
  return { path: planned, skipReason: t('Skipped because no free output file name was found.') };
}
