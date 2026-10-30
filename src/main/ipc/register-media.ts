import { isAbsolute } from 'node:path';
import { t } from '@shared/i18n';
import { IPC } from '@shared/ipc';
import { UserError } from '../log';
import { mediaDetails, probeFiles } from '../media/probe';
import { createThumbnail } from '../media/thumbnail';
import { assertString, handle } from './handle';

function absolutePath(value: unknown): string {
  const filePath = assertString(value, 'file path');
  if (!isAbsolute(filePath)) throw new UserError(t('File paths must be absolute.'));
  return filePath;
}

export function registerMediaIpc(): void {
  handle(IPC.mediaProbe, (value) => {
    if (!Array.isArray(value) || value.length > 5000) throw new UserError(t('Invalid file list.'));
    return probeFiles(value.map(absolutePath));
  });
  handle(IPC.mediaThumbnail, (value) => createThumbnail(absolutePath(value)));
  handle(IPC.mediaDetails, async (value) => {
    try {
      return await mediaDetails(absolutePath(value));
    } catch (error) {
      if (error instanceof UserError) throw error;
      throw new UserError(t('FFprobe could not read this file. It may be damaged or not a media file.'));
    }
  });
}
