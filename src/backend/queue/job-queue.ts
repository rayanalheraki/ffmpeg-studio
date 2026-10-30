import { t } from '@shared/i18n';
import { computeProgress, emptyProgress } from '@shared/jobs/progress';
import type { JobEvent, JobOutputInfo, JobSnapshot, JobStatus } from '@shared/types/jobs';
import { summarizeFailure } from '../ffmpeg/errors';
import { appendLog, runFfmpeg, type RunHandle } from '../ffmpeg/runner';
import { host } from '../host';
import { UserError, createLogger } from '../log';

const log = createLogger('queue');
const PROGRESS_EMIT_INTERVAL_MS = 150;

/** Everything needed to run a job, computed once when the batch is created. */
export interface JobSpec {
  id: string;
  batchId: string;
  operationId: string;
  operationLabel: string;
  title: string;
  inputPaths: string[];
  outputPath: string;
  /** FFmpeg arguments without the binary. */
  args: string[];
  expectedDuration: number | null;
  /** Image sequences write many files and are not cleaned up on failure. */
  isSequence: boolean;
  /** When set, the job is not run and is recorded as skipped. */
  skipReason: string | null;
}

export interface BatchSummary {
  completed: number;
  failed: number;
  cancelled: number;
}

export interface QueueHooks {
  emit(event: JobEvent): void;
  onBatchFinished(summary: BatchSummary): void;
  /** Reads a finished output file for display; null when it cannot be read. */
  describeOutput(filePath: string): Promise<JobOutputInfo | null>;
}

interface JobRecord {
  spec: JobSpec;
  snapshot: JobSnapshot;
  log: string;
  handle: RunHandle | null;
  lastEmit: number;
}

const FINISHED: readonly JobStatus[] = ['completed', 'failed', 'cancelled'];

export class JobQueue {
  private readonly jobs = new Map<string, JobRecord>();
  private running = 0;
  private session: BatchSummary & { active: boolean } = { completed: 0, failed: 0, cancelled: 0, active: false };

  constructor(
    private readonly hooks: QueueHooks,
    private concurrency: number,
  ) {}

  add(specs: JobSpec[]): JobSnapshot[] {
    for (const spec of specs) {
      const snapshot: JobSnapshot = {
        id: spec.id,
        batchId: spec.batchId,
        operationId: spec.operationId,
        operationLabel: spec.operationLabel,
        title: spec.title,
        inputPaths: spec.inputPaths,
        outputPath: spec.outputPath,
        command: ['ffmpeg', ...spec.args],
        status: spec.skipReason ? 'cancelled' : 'queued',
        progress: emptyProgress(),
        message: spec.skipReason,
        skipped: spec.skipReason != null,
        createdAt: Date.now(),
        startedAt: null,
        finishedAt: spec.skipReason ? Date.now() : null,
        hasLog: false,
        output: null,
      };
      this.jobs.set(spec.id, { spec, snapshot, log: '', handle: null, lastEmit: 0 });
      if (spec.skipReason) this.session.cancelled += 1;
      this.session.active = true;
      this.emit(spec.id);
    }
    this.pump();
    return specs.map((spec) => this.jobs.get(spec.id)?.snapshot).filter((s): s is JobSnapshot => s !== undefined);
  }

  list(): JobSnapshot[] {
    return [...this.jobs.values()].map((record) => record.snapshot);
  }

  getLog(id: string): string {
    return this.jobs.get(id)?.log ?? '';
  }

  /** Output paths of jobs that have not finished, used to avoid two jobs writing the same file. */
  pendingOutputs(): Set<string> {
    return new Set(
      [...this.jobs.values()]
        .filter((record) => !FINISHED.includes(record.snapshot.status))
        .map((record) => record.spec.outputPath.toLowerCase()),
    );
  }

  setConcurrency(value: number): void {
    this.concurrency = value;
    this.pump();
  }

  cancel(id: string): void {
    const record = this.jobs.get(id);
    if (!record) return;
    if (record.snapshot.status === 'queued') this.finish(record, 'cancelled', t('Cancelled before starting.'));
    else if (record.snapshot.status === 'running') record.handle?.cancel();
    this.pump();
  }

  cancelAll(): void {
    for (const record of this.jobs.values()) {
      if (record.snapshot.status === 'queued') this.finish(record, 'cancelled', t('Cancelled before starting.'));
    }
    for (const record of this.jobs.values()) {
      if (record.snapshot.status === 'running') record.handle?.cancel();
    }
  }

  retry(id: string): void {
    const record = this.jobs.get(id);
    if (!record || !(record.snapshot.status === 'failed' || record.snapshot.status === 'cancelled')) return;
    if (record.spec.skipReason) return;
    record.log = '';
    record.snapshot = {
      ...record.snapshot,
      status: 'queued',
      progress: emptyProgress(),
      message: null,
      startedAt: null,
      finishedAt: null,
      hasLog: false,
      output: null,
    };
    this.session.active = true;
    this.emit(id);
    this.pump();
  }

  remove(id: string): void {
    const record = this.jobs.get(id);
    if (!record) return;
    if (record.snapshot.status === 'running') {
      record.handle?.cancel();
      return;
    }
    this.jobs.delete(id);
    this.hooks.emit({ type: 'remove', ids: [id] });
  }

  clearFinished(): void {
    const ids = [...this.jobs.values()].filter((record) => FINISHED.includes(record.snapshot.status)).map((record) => record.spec.id);
    for (const id of ids) this.jobs.delete(id);
    if (ids.length > 0) this.hooks.emit({ type: 'remove', ids });
  }

  /** Kills every running process immediately, e.g. when the app quits. */
  shutdown(): void {
    for (const record of this.jobs.values()) {
      if (record.snapshot.status === 'queued') record.snapshot.status = 'cancelled';
      record.handle?.cancel();
    }
  }

  private pump(): void {
    for (const record of this.jobs.values()) {
      if (this.running >= this.concurrency) break;
      if (record.snapshot.status === 'queued') this.start(record);
    }
    const idle = this.running === 0 && ![...this.jobs.values()].some((record) => record.snapshot.status === 'queued');
    if (idle && this.session.active) {
      const { completed, failed, cancelled } = this.session;
      this.session = { completed: 0, failed: 0, cancelled: 0, active: false };
      this.hooks.onBatchFinished({ completed, failed, cancelled });
    }
  }

  private start(record: JobRecord): void {
    this.running += 1;
    const startedAt = Date.now();
    record.snapshot = { ...record.snapshot, status: 'running', startedAt, progress: emptyProgress() };
    this.emit(record.spec.id);

    log.info(`Starting job ${record.spec.id}: ${record.spec.title}`);
    record.handle = runFfmpeg(record.spec.args, {
      onLog: (chunk) => {
        record.log = appendLog(record.log, chunk);
      },
      onProgress: (sample) => {
        record.snapshot.progress = computeProgress(sample, record.spec.expectedDuration, Date.now() - startedAt);
        const now = Date.now();
        if (now - record.lastEmit >= PROGRESS_EMIT_INTERVAL_MS) this.emit(record.spec.id, now);
      },
    });

    void record.handle.done.then(async (outcome) => {
      this.running -= 1;
      record.handle = null;
      if (outcome.cancelled) {
        await this.removePartialOutput(record);
        this.finish(record, 'cancelled', t('Cancelled.'));
      } else if (outcome.spawnError) {
        record.log = appendLog(record.log, `\n${outcome.spawnError.message}\n`);
        // A missing binary already carries a specific message.
        const reason =
          outcome.spawnError instanceof UserError
            ? outcome.spawnError.message
            : t('FFmpeg could not be started. The bundled binary may be blocked by security software.');
        this.finish(record, 'failed', reason);
      } else if (outcome.exitCode === 0) {
        record.snapshot.output = await this.describeOutput(record);
        this.finish(record, 'completed', null);
      } else {
        await this.removePartialOutput(record);
        this.finish(record, 'failed', summarizeFailure(record.log, outcome.exitCode));
      }
      this.pump();
    });
  }

  private finish(record: JobRecord, status: JobStatus, message: string | null): void {
    const progress = status === 'completed' ? { ...record.snapshot.progress, percent: 100, etaMs: 0 } : record.snapshot.progress;
    record.snapshot = { ...record.snapshot, status, message, progress, finishedAt: Date.now(), hasLog: record.log.length > 0 };
    if (status === 'completed') this.session.completed += 1;
    else if (status === 'failed') this.session.failed += 1;
    else if (status === 'cancelled') this.session.cancelled += 1;
    if (status === 'failed') log.warn(`Job ${record.spec.id} failed: ${message ?? 'unknown error'}`);
    this.emit(record.spec.id);
  }

  private async describeOutput(record: JobRecord): Promise<JobOutputInfo | null> {
    if (record.spec.isSequence) return null;
    try {
      return await this.hooks.describeOutput(record.spec.outputPath);
    } catch (error) {
      log.warn(`Could not read output ${record.spec.outputPath}`, error);
      return null;
    }
  }

  private async removePartialOutput(record: JobRecord): Promise<void> {
    if (record.spec.isSequence || record.snapshot.startedAt == null) return;
    try {
      await host.removeFile(record.spec.outputPath);
    } catch (error) {
      log.warn(`Could not remove partial output ${record.spec.outputPath}`, error);
    }
  }

  private emit(id: string, now = Date.now()): void {
    const record = this.jobs.get(id);
    if (!record) return;
    record.lastEmit = now;
    this.hooks.emit({ type: 'upsert', job: { ...record.snapshot, progress: { ...record.snapshot.progress } } });
  }
}
