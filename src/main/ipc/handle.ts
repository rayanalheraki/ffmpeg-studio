import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { t } from '@shared/i18n';
import type { IpcResult } from '@shared/ipc';
import { UserError, createLogger } from '../log';

const log = createLogger('ipc');

/** Only our own renderer (dev server or packaged file) may call into the main process. */
export function isTrustedSender(event: IpcMainInvokeEvent | IpcMainEvent): boolean {
  const url = event.senderFrame?.url ?? '';
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  return url.startsWith('file://') || (devUrl !== undefined && url.startsWith(devUrl));
}

/**
 * Registers an `invoke` handler that validates the sender and converts errors
 * into a result envelope. Unexpected errors are logged with full detail and
 * reported to the user with a generic message.
 */
export function handle(channel: string, handler: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]): Promise<IpcResult<unknown>> => {
    if (!isTrustedSender(event)) {
      log.warn(`Rejected ${channel} from untrusted sender ${event.senderFrame?.url ?? 'unknown'}`);
      return { ok: false, error: t('This request was blocked.') };
    }
    try {
      return { ok: true, value: await handler(...args) };
    } catch (error) {
      if (error instanceof UserError) return { ok: false, error: error.message };
      log.error(`Handler for ${channel} failed`, error);
      return { ok: false, error: t('Something went wrong. Details were written to the application log.') };
    }
  });
}

/** Registers a fire-and-forget `send` listener with the same sender check. */
export function listen(channel: string, listener: (event: IpcMainEvent, ...args: unknown[]) => void): void {
  ipcMain.on(channel, (event, ...args: unknown[]) => {
    if (isTrustedSender(event)) listener(event, ...args);
  });
}

export function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value === '') throw new UserError(t('Invalid {name}.', { name: label }));
  return value;
}
