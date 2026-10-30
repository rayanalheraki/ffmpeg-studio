import { useCallback } from 'react';
import { isSlotVisible } from '@shared/jobs/plan';
import { extensionOf, kindFromExtension } from '@shared/media/kinds';
import type { AnyOperation, OptionValues } from '@shared/operations/types';
import { errorMessage, studio } from '../lib/api';
import { useFiles } from '../state/files';
import { MAIN_SLOT } from '../state/files-reducer';
import { useToasts } from '../state/toasts';
import { useI18n } from '../state/i18n';

/**
 * Adding files with as little effort as possible: dropped files the primary
 * input cannot use are routed to a matching secondary slot automatically
 * (e.g. a subtitle file dropped together with videos).
 */
export function useAddFiles(operation: AnyOperation, options: OptionValues) {
  const { addPaths } = useFiles();
  const { show } = useToasts();
  const { t, locale } = useI18n();

  const route = useCallback(
    (paths: string[]) => {
      const slots = (operation.extraSlots ?? []).filter((slot) => isSlotVisible(slot, options));
      const buckets = new Map<string, string[]>();
      for (const path of paths) {
        const kind = kindFromExtension(extensionOf(path));
        const slot = operation.input.accept.includes(kind) ? undefined : slots.find((candidate) => candidate.accept.includes(kind));
        const target = slot?.id ?? MAIN_SLOT;
        buckets.set(target, [...(buckets.get(target) ?? []), path]);
      }
      for (const [slotId, slotPaths] of buckets) {
        const slot = slots.find((candidate) => candidate.id === slotId);
        if (slot && !slot.multiple) addPaths(slotId, slotPaths.slice(0, 1), true);
        else addPaths(slotId, slotPaths);
      }
    },
    [operation, options, addPaths],
  );

  const browse = useCallback(
    (slotId: string = MAIN_SLOT) => {
      const slot = operation.extraSlots?.find((candidate) => candidate.id === slotId);
      const kinds = slot ? slot.accept : operation.input.accept;
      studio.dialog
        .openFiles({
          title: slot ? t('Choose {name}', { name: t(slot.label).toLocaleLowerCase(locale) }) : t('Add files'),
          kinds,
          multiple: slot ? slot.multiple : true,
        })
        .then((paths) => {
          if (paths.length === 0) return;
          if (slot) addPaths(slot.id, slot.multiple ? paths : paths.slice(0, 1), !slot.multiple);
          else route(paths);
        })
        .catch((error: unknown) => show('error', t('Could not open the file picker'), errorMessage(error)));
    },
    [operation, addPaths, route, show, t, locale],
  );

  return { route, browse };
}
