import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { t } from '@shared/i18n';
import { probeArgs } from '@shared/operations/definitions/media-info';
import type { MediaDetails, MediaFile } from '@shared/types/media';
import { getBinaries } from '../ffmpeg/binaries';
import { capture } from '../ffmpeg/capture';
import { createLogger } from '../log';
import { createLimiter } from '../utils/limiter';
import { type RawProbe, toMediaDetails, toMediaFile, unreadableFile } from './parse-probe';

const log = createLogger('probe');
const limit = createLimiter(4);

interface CacheEntry {
  key: string;
  raw: RawProbe;
  file: MediaFile;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE = 2000;

async function runProbe(filePath: string): Promise<RawProbe> {
  const result = await limit(() =>
    capture(getBinaries().ffprobe, probeArgs(filePath), { timeoutMs: 30_000, maxStdoutBytes: 16 * 1024 * 1024 }),
  );
  if (result.code !== 0) {
    const reason = result.stderr.trim().split(/\r?\n/).pop() ?? `FFprobe exited with code ${result.code}`;
    throw new Error(reason);
  }
  return JSON.parse(result.stdout.toString('utf8')) as RawProbe;
}

async function probeEntry(filePath: string): Promise<CacheEntry> {
  const info = await stat(filePath);
  const key = `${info.size}:${info.mtimeMs}`;
  const cached = cache.get(filePath);
  if (cached && cached.key === key) return cached;

  const raw = await runProbe(filePath);
  const entry: CacheEntry = { key, raw, file: toMediaFile(cached?.file.id ?? randomUUID(), filePath, info.size, raw) };
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(filePath, entry);
  return entry;
}

/** Probes one file. Unreadable files are returned with `probeError` set instead of throwing. */
export async function probeFile(filePath: string): Promise<MediaFile> {
  try {
    return (await probeEntry(filePath)).file;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log.warn(`Could not read ${filePath}`, reason);
    const size = await stat(filePath).then(
      (s) => s.size,
      () => 0,
    );
    const isMissing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    return unreadableFile(randomUUID(), filePath, size, isMissing ? t('File not found.') : t('Not a readable media file.'));
  }
}

export function probeFiles(paths: readonly string[]): Promise<MediaFile[]> {
  return Promise.all(paths.map((filePath) => probeFile(filePath)));
}

export async function mediaDetails(filePath: string): Promise<MediaDetails> {
  const entry = await probeEntry(filePath);
  return toMediaDetails(filePath, entry.file.size, entry.raw);
}
