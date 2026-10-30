import { type CaptureResult, type Program, host } from '../host';

export type { CaptureResult };

export interface CaptureOptions {
  timeoutMs: number;
  maxStdoutBytes: number;
  /** `base64` for binary output such as thumbnails. */
  encoding?: 'text' | 'base64';
}

/**
 * Runs a short-lived bundled binary (FFprobe, thumbnail extraction) and
 * collects its output. Arguments are always passed as an array, never through a shell.
 */
export function capture(program: Program, args: readonly string[], options: CaptureOptions): Promise<CaptureResult> {
  return host.capture(program, args, {
    timeoutMs: options.timeoutMs,
    maxStdoutBytes: options.maxStdoutBytes,
    encoding: options.encoding ?? 'text',
  });
}
