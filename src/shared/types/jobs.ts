import type { OptionValues } from '../operations/types';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type OverwriteBehavior = 'overwrite' | 'rename' | 'skip';

export interface OutputSettings {
  /** Absolute folder path, or null to write next to each source file. */
  directory: string | null;
  /** Naming pattern, e.g. `{name}_{op}`. See `NAMING_TOKENS`. */
  pattern: string;
  overwrite: OverwriteBehavior;
}

export interface JobProgress {
  /** 0–100, or null when the expected duration is unknown. */
  percent: number | null;
  /** Encoding speed as a multiple of real time (e.g. 2.5 = 2.5x). */
  speed: number | null;
  elapsedMs: number;
  etaMs: number | null;
  /** Seconds of output media produced so far. */
  processedSeconds: number;
}

/** What FFprobe found in a finished job's output file. */
export interface JobOutputInfo {
  fileName: string;
  size: number;
  /** Lower-case extension without the dot. */
  ext: string;
  width: number | null;
  height: number | null;
}

export interface JobSnapshot {
  id: string;
  batchId: string;
  operationId: string;
  operationLabel: string;
  /** Short display title, usually the primary input file name. */
  title: string;
  inputPaths: string[];
  outputPath: string;
  /** Full argv, starting with the binary name. */
  command: string[];
  status: JobStatus;
  progress: JobProgress;
  /** User-friendly status detail (error summary, skip reason). */
  message: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  hasLog: boolean;
  /** Set once a job completes and its output could be read. */
  output: JobOutputInfo | null;
}

export interface StartBatchRequest {
  operationId: string;
  options: OptionValues;
  /** Primary input file paths, in user-defined order. */
  main: string[];
  /** Secondary slot file paths keyed by slot id. */
  extra: Record<string, string[]>;
  output: OutputSettings;
  /** Extra FFmpeg arguments typed by the user, inserted before the output path. */
  extraArgs: string;
}

export interface StartBatchResult {
  jobs: JobSnapshot[];
  /** Notes about inputs that were ignored (e.g. unsupported files). */
  warnings: string[];
}

export type JobEvent = { type: 'upsert'; job: JobSnapshot } | { type: 'remove'; ids: string[] };
