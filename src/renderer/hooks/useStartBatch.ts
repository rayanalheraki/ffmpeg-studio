import { useCallback, useState } from 'react';
import type { AnyOperation, OptionValues } from '@shared/operations/types';
import { errorMessage, studio } from '../lib/api';
import { useFiles } from '../state/files';
import { MAIN_SLOT, readyFiles } from '../state/files-reducer';
import { useSettings } from '../state/settings';
import { useToasts } from '../state/toasts';
import type { BatchPreview } from './useBatchPreview';

/** Sends the current batch to the main process queue. */
export function useStartBatch(operation: AnyOperation, options: OptionValues, extraArgs: string, preview: BatchPreview) {
  const { slots } = useFiles();
  const { settings, update } = useSettings();
  const { show } = useToasts();
  const [starting, setStarting] = useState(false);

  const start = useCallback(async () => {
    if (starting) return;
    if (preview.problem) {
      show('warning', 'Not ready yet', preview.problem);
      return;
    }
    setStarting(true);
    try {
      const extra = Object.fromEntries(
        (operation.extraSlots ?? []).map((slot) => [slot.id, readyFiles(slots[slot.id]).map((f) => f.path)]),
      );
      const result = await studio.jobs.start({
        operationId: operation.id,
        options,
        main: readyFiles(slots[MAIN_SLOT]).map((file) => file.path),
        extra,
        output: settings.output,
        extraArgs,
      });
      const count = result.jobs.length;
      show('success', `${count} job${count === 1 ? '' : 's'} added to the queue`, operation.label);
      if (result.warnings.length > 0) {
        show(
          'warning',
          `${result.warnings.length} file${result.warnings.length === 1 ? ' was' : 's were'} skipped`,
          result.warnings.slice(0, 3).join('\n'),
        );
      }
      if (!settings.queueOpen) update({ queueOpen: true });
    } catch (error) {
      show('error', 'Could not start', errorMessage(error));
    } finally {
      setStarting(false);
    }
  }, [starting, preview.problem, operation, options, slots, settings.output, settings.queueOpen, extraArgs, show, update]);

  return { start, starting };
}
