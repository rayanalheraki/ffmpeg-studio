import type { MediaFile } from '../types/media';
import type { AnyOperation, ExtraSlot, JobInputs, OptionValues } from '../operations/types';

export interface PlanResult {
  jobs: JobInputs[];
  /** Files from the primary list that this operation cannot use. */
  skipped: MediaFile[];
  /** Blocking problem with the batch as a whole, if any. */
  error: string | null;
}

export function acceptsFile(accept: readonly string[], file: MediaFile): boolean {
  return file.probeError == null && accept.includes(file.kind);
}

export function isSlotVisible(slot: ExtraSlot, options: OptionValues): boolean {
  return slot.visibleWhen ? slot.visibleWhen(options) : true;
}

export function isSlotRequired(slot: ExtraSlot, options: OptionValues): boolean {
  return isSlotVisible(slot, options) && (slot.requiredWhen ? slot.requiredWhen(options) : true);
}

/** Files of a secondary slot assigned to job `index` of `jobCount`. */
function slotFilesForJob(slot: ExtraSlot, files: MediaFile[], index: number): MediaFile[] {
  if (slot.distribution === 'all' || files.length <= 1) return files;
  const file = files[index];
  return file ? [file] : [];
}

/**
 * Splits a batch into jobs according to the operation's batch mode and slot
 * distribution rules. Pure and deterministic, so the renderer preview and the
 * main process always agree on what will run.
 */
export function planJobs(
  operation: AnyOperation,
  options: OptionValues,
  main: MediaFile[],
  extra: Record<string, MediaFile[]>,
): PlanResult {
  const usable = main.filter((file) => acceptsFile(operation.input.accept, file));
  const skipped = main.filter((file) => !acceptsFile(operation.input.accept, file));
  const minFiles = operation.input.minFiles ?? 1;

  if (usable.length < minFiles) {
    const error =
      usable.length === 0 ? 'Add at least one supported file to get started.' : `This operation needs at least ${minFiles} files.`;
    return { jobs: [], skipped, error };
  }

  const groups = operation.batch === 'combine' ? [usable] : usable.map((file) => [file]);
  const slots = (operation.extraSlots ?? []).filter((slot) => isSlotVisible(slot, options));

  for (const slot of slots) {
    const files = (extra[slot.id] ?? []).filter((file) => acceptsFile(slot.accept, file));
    if (files.length === 0 && isSlotRequired(slot, options)) {
      return { jobs: [], skipped, error: `Add a file to “${slot.label}”.` };
    }
    if (slot.distribution === 'paired' && files.length > 1 && files.length !== groups.length) {
      return {
        jobs: [],
        skipped,
        error: `“${slot.label}” has ${files.length} files for ${groups.length} jobs. Add one file for all jobs, or exactly one per job.`,
      };
    }
  }

  const jobs = groups.map((group, index) => {
    const jobExtra: Record<string, MediaFile[]> = {};
    for (const slot of slots) {
      const files = (extra[slot.id] ?? []).filter((file) => acceptsFile(slot.accept, file));
      jobExtra[slot.id] = slotFilesForJob(slot, files, index);
    }
    return { main: group, extra: jobExtra };
  });

  return { jobs, skipped, error: null };
}
