import { useMemo } from 'react';
import { assembleArgs, formatCommand, splitArgs } from '@shared/jobs/command';
import { plannedOutputPath } from '@shared/jobs/output';
import { planJobs } from '@shared/jobs/plan';
import type { AnyOperation, OptionValues } from '@shared/operations/types';
import type { MediaFile } from '@shared/types/media';
import { useFiles } from '../state/files';
import { MAIN_SLOT, readyFiles } from '../state/files-reducer';
import { useSettings } from '../state/settings';
import { useI18n } from '../state/i18n';

export interface BatchPreview {
  /** Jobs that will actually run. */
  jobCount: number;
  /** Primary files the operation cannot use. */
  unsupported: MediaFile[];
  /** Per-file problems that exclude a job, e.g. "no audio track". */
  excluded: { file: MediaFile; reason: string }[];
  /** Blocking problem; Start is disabled while set. */
  problem: string | null;
  /** Exact command for the first job, for the Advanced panel. */
  command: string | null;
  outputPath: string | null;
  probing: boolean;
}

export function useBatchPreview(operation: AnyOperation, options: OptionValues, extraArgs: string): BatchPreview {
  const { slots } = useFiles();
  const { settings, environment } = useSettings();
  const { t } = useI18n();

  return useMemo(() => {
    const slotIds = [MAIN_SLOT, ...(operation.extraSlots ?? []).map((slot) => slot.id)];
    const probing = slotIds.some((id) => (slots[id] ?? []).some((entry) => entry.file == null));
    const extra = Object.fromEntries((operation.extraSlots ?? []).map((slot) => [slot.id, readyFiles(slots[slot.id])]));
    const plan = planJobs(operation, options, readyFiles(slots[MAIN_SLOT]), extra);

    const excluded: BatchPreview['excluded'] = [];
    let batchProblem: string | null = null;
    const runnable = plan.jobs.filter((inputs) => {
      const reason = operation.validate?.(options, inputs) ?? null;
      const file = inputs.main[0];
      // A combined job's problem concerns the whole batch, not its first file.
      if (reason && operation.batch === 'combine') batchProblem = reason;
      else if (reason && file) excluded.push({ file, reason });
      return reason == null;
    });

    const split = splitArgs(extraArgs);
    let problem = plan.error ?? split.error ?? batchProblem ?? (runnable.length === 0 && excluded[0] ? excluded[0].reason : null);
    if (probing && !problem) problem = t('Reading files…');

    let command: string | null = null;
    let outputPath: string | null = null;
    const first = runnable[0];
    if (first && operation.mode !== 'inspect') {
      try {
        outputPath = plannedOutputPath(operation, options, first, settings.output, 0);
        const args = assembleArgs(operation.buildArgs(options, first, { output: outputPath, fontFile: environment.fontFile }), split.args);
        command = formatCommand(['ffmpeg', ...args], environment.platform);
      } catch (error) {
        console.error('Could not build the command preview', error);
        problem = t('These settings cannot be turned into an FFmpeg command.');
      }
    }

    return { jobCount: runnable.length, unsupported: plan.skipped, excluded, problem, command, outputPath, probing };
  }, [operation, options, extraArgs, slots, settings.output, environment, t]);
}
