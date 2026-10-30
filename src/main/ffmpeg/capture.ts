import { spawn } from 'node:child_process';

export interface CaptureResult {
  code: number | null;
  stdout: Buffer;
  stderr: string;
}

export interface CaptureOptions {
  timeoutMs: number;
  maxStdoutBytes: number;
}

/**
 * Runs a short-lived binary (FFprobe, thumbnail extraction) and collects its
 * output. Arguments are always passed as an array, never through a shell.
 */
export function capture(binary: string, args: readonly string[], options: CaptureOptions): Promise<CaptureResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let size = 0;
    let stderr = '';
    let settled = false;

    const finish = (error: Error | null, code: number | null = null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve({ code, stdout: Buffer.concat(chunks), stderr });
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(new Error(`${binary} timed out after ${options.timeoutMs} ms.`));
    }, options.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > options.maxStdoutBytes) {
        child.kill();
        finish(new Error('Process output exceeded the allowed size.'));
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < 64 * 1024) stderr += chunk;
    });
    child.on('error', (error) => finish(error));
    child.on('close', (code) => finish(null, code));
  });
}
