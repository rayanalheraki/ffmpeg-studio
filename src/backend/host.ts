import { Channel, invoke } from '@tauri-apps/api/core';
import { t } from '@shared/i18n';
import { UserError } from './log';

/**
 * Typed wrappers for the Rust commands in src-tauri/src. This is the only
 * module that talks to the native side directly.
 */

export type Program = 'ffmpeg' | 'ffprobe';

export interface PathInfo {
  isFile: boolean;
  isDir: boolean;
  size: number;
  modifiedMs: number;
}

export interface HostInfo {
  platform: 'win32' | 'darwin' | 'linux' | 'other';
  windowsDir: string | null;
}

export interface CaptureResult {
  code: number | null;
  /** UTF-8 text, or base64 when captured with `encoding: 'base64'`. */
  stdout: string;
  stderr: string;
}

export type ProcessEvent = { type: 'stdout'; data: string } | { type: 'stderr'; data: string } | { type: 'exit'; code: number | null };

const BINARY_NAMES: Record<Program, string> = { ffmpeg: 'FFmpeg', ffprobe: 'FFprobe' };

/** Turns the machine-readable errors from process.rs into translated messages. */
function processError(error: unknown): Error {
  const message = typeof error === 'string' ? error : error instanceof Error ? error.message : String(error);
  const missing = /^binary-missing:(ffmpeg|ffprobe)$/.exec(message)?.[1] as Program | undefined;
  if (missing) {
    return new UserError(
      t('The bundled {name} binary is missing. Reinstall the app or run "npm install" again.', { name: BINARY_NAMES[missing] }),
    );
  }
  return new Error(message);
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw processError(error);
  }
}

export const host = {
  info: () => call<HostInfo>('host_info'),
  pathInfo: (path: string) => call<PathInfo | null>('path_info', { path }),
  exists: async (path: string) => (await call<PathInfo | null>('path_info', { path })) !== null,
  createDirAll: (path: string) => call<null>('create_dir_all', { path }),
  removeFile: (path: string) => call<null>('remove_file', { path }),
  revealPath: (path: string) => call<null>('reveal_path', { path }),
  openPath: (path: string) => call<null>('open_path', { path }),
  readSettings: () => call<string | null>('read_settings'),
  writeSettings: (contents: string) => call<null>('write_settings', { contents }),

  capture: (
    program: Program,
    args: readonly string[],
    options: { timeoutMs: number; maxStdoutBytes: number; encoding: 'text' | 'base64' },
  ) => call<CaptureResult>('process_capture', { program, args, ...options }),

  /** Starts a process and streams its output. Resolves with an id for `kill`. */
  spawn: (program: Program, args: readonly string[], onEvent: (event: ProcessEvent) => void) => {
    const channel = new Channel<ProcessEvent>();
    channel.onmessage = onEvent;
    return call<number>('process_spawn', { program, args, onEvent: channel });
  },
  kill: (id: number) => call<null>('process_kill', { id }),
};
