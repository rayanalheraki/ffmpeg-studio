import { spawn } from 'node:child_process';
import { ProgressParser, type ProgressSample } from '@shared/jobs/progress';
import { MAX_LOG_LENGTH } from '@shared/constants';

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
export function runFfmpeg(binary: string, args: readonly string[], callbacks: RunCallbacks): RunHandle {
  const child = spawn(binary, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const parser = new ProgressParser();
  let cancelled = false;
  let spawnError: Error | null = null;

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    for (const sample of parser.push(chunk)) callbacks.onProgress(sample);
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => callbacks.onLog(chunk));

  const done = new Promise<RunOutcome>((resolve) => {
    child.on('error', (error) => {
      spawnError = error;
    });
    child.on('close', (code) => resolve({ exitCode: code, cancelled, spawnError }));
  });

  return {
    done,
    cancel: () => {
      if (child.exitCode !== null || cancelled) return;
      cancelled = true;
      child.kill('SIGKILL');
    },
  };
}

/** Appends to a log while keeping only the most recent `MAX_LOG_LENGTH` characters. */
export function appendLog(log: string, chunk: string): string {
  const next = log + chunk;
  return next.length > MAX_LOG_LENGTH ? `[earlier output truncated]\n${next.slice(-MAX_LOG_LENGTH)}` : next;
}
