import type { JobProgress } from '../types/jobs';
import { parseTime } from '../utils/time';

export interface ProgressSample {
  /** Seconds of output written so far. */
  outTime: number;
  /** Multiple of real time, or null if FFmpeg reports N/A. */
  speed: number | null;
  done: boolean;
}

/**
 * Incremental parser for `-progress pipe:1` output. FFmpeg writes blocks of
 * `key=value` lines terminated by `progress=continue` or `progress=end`.
 */
export class ProgressParser {
  private buffer = '';
  private fields = new Map<string, string>();

  push(chunk: string): ProgressSample[] {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? '';
    const samples: ProgressSample[] = [];

    for (const line of lines) {
      const separator = line.indexOf('=');
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      this.fields.set(key, value);
      if (key === 'progress') {
        samples.push(this.toSample(value === 'end'));
        this.fields.clear();
      }
    }
    return samples;
  }

  private toSample(done: boolean): ProgressSample {
    const micros = Number(this.fields.get('out_time_us') ?? this.fields.get('out_time_ms'));
    const fromClock = parseTime(this.fields.get('out_time') ?? '');
    const outTime = Number.isFinite(micros) && micros >= 0 ? micros / 1_000_000 : (fromClock ?? 0);
    const speedMatch = /^([\d.]+)x$/.exec(this.fields.get('speed') ?? '');
    const speed = speedMatch ? Number(speedMatch[1]) : null;
    return { outTime, speed: speed != null && Number.isFinite(speed) && speed > 0 ? speed : null, done };
  }
}

export function emptyProgress(): JobProgress {
  return { percent: null, speed: null, elapsedMs: 0, etaMs: null, processedSeconds: 0 };
}

/** Derives percentage and ETA from a sample and the expected output duration. */
export function computeProgress(sample: ProgressSample, expectedDuration: number | null, elapsedMs: number): JobProgress {
  const known = expectedDuration != null && expectedDuration > 0;
  const percent = sample.done ? 100 : known ? Math.min(99.9, (sample.outTime / expectedDuration) * 100) : null;

  let etaMs: number | null = null;
  if (sample.done) etaMs = 0;
  else if (known && sample.speed) etaMs = (Math.max(0, expectedDuration - sample.outTime) / sample.speed) * 1000;
  else if (percent != null && percent > 0) etaMs = (elapsedMs * (100 - percent)) / percent;

  return { percent, speed: sample.speed, elapsedMs, etaMs, processedSeconds: sample.outTime };
}
