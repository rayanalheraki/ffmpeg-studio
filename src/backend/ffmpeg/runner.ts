import { ProgressParser, type ProgressSample } from '@shared/jobs/progress';
import { MAX_LOG_LENGTH } from '@shared/constants';
import { host } from '../host';

export interface RunCallbacks {
  onProgress(sample: ProgressSample): void;
  onLog(chunk: string): void;
}

export interface RunOutcome {
  exitCode: number | null;
  cancelled: boolean;
  /** Set when the process could not be started at all. */
  spawnError: Error | null;
}

export interface RunHandle {
  done: Promise<RunOutcome>;
  cancel(): void;
}

/**
 * Starts one FFmpeg process. Progress arrives on stdout (`-progress pipe:1`),
 * the human-readable log on stderr.
 */
export function runFfmpeg(args: readonly string[], callbacks: RunCallbacks): RunHandle {
  const parser = new ProgressParser();
  let cancelled = false;
  let exited = false;
  let processId: number | null = null;

  const done = new Promise<RunOutcome>((resolve) => {
    host
      .spawn('ffmpeg', args, (event) => {
        if (event.type === 'stdout') {
          for (const sample of parser.push(event.data)) callbacks.onProgress(sample);
        } else if (event.type === 'stderr') {
          callbacks.onLog(event.data);
        } else {
          exited = true;
          resolve({ exitCode: event.code, cancelled, spawnError: null });
        }
      })
      .then(
        (id) => {
          processId = id;
          // Cancelled while the process was still starting.
          if (cancelled && !exited) void host.kill(id);
        },
        (error: unknown) => resolve({ exitCode: null, cancelled, spawnError: error instanceof Error ? error : new Error(String(error)) }),
      );
  });

  return {
    done,
    cancel: () => {
      if (exited || cancelled) return;
      cancelled = true;
      if (processId !== null) void host.kill(processId);
    },
  };
}

/** Appends to a log while keeping only the most recent `MAX_LOG_LENGTH` characters. */
export function appendLog(log: string, chunk: string): string {
  const next = log + chunk;
  return next.length > MAX_LOG_LENGTH ? `[earlier output truncated]\n${next.slice(-MAX_LOG_LENGTH)}` : next;
}
