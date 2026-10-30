import { toFfmpegTime } from '@shared/utils/time';
import { getBinaries } from '../ffmpeg/binaries';
import { capture } from '../ffmpeg/capture';
import { createLogger } from '../log';
import { createLimiter } from '../utils/limiter';
import { probeFile } from './probe';

const log = createLogger('thumbnail');
const limit = createLimiter(3);
const cache = new Map<string, string | null>();
const MAX_CACHE = 500;

const OUTPUT_ARGS = ['-frames:v', '1', '-vf', 'scale=320:-2', '-f', 'image2pipe', '-c:v', 'mjpeg', '-q:v', '5', 'pipe:1'];

async function thumbnailArgs(filePath: string): Promise<string[] | null> {
  const file = await probeFile(filePath);
  if (file.probeError) return null;
  if (file.kind === 'image') return ['-i', filePath, ...OUTPUT_ARGS];
  if (file.hasVideo) {
    // Skip black intro frames, but stay close to the start for short clips.
    const seek = file.duration ? Math.min(file.duration * 0.1, 10) : 0;
    return ['-ss', toFfmpegTime(seek), '-i', filePath, '-map', '0:v:0', ...OUTPUT_ARGS];
  }
  if (file.kind === 'audio') {
    // Embedded cover art is a video stream with the attached_pic disposition; files without one yield no output.
    return ['-i', filePath, '-map', '0:v:0?', ...OUTPUT_ARGS];
  }
  return null;
}

/** Returns a small JPEG data URL for a media file, or null when it has no picture. */
export async function createThumbnail(filePath: string): Promise<string | null> {
  if (cache.has(filePath)) return cache.get(filePath) ?? null;

  const args = await thumbnailArgs(filePath);
  let result: string | null = null;
  if (args) {
    try {
      const output = await limit(() =>
        capture(getBinaries().ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args], {
          timeoutMs: 20_000,
          maxStdoutBytes: 4 * 1024 * 1024,
        }),
      );
      if (output.code === 0 && output.stdout.length > 0) result = `data:image/jpeg;base64,${output.stdout.toString('base64')}`;
      else log.info(`No picture available for ${filePath}`);
    } catch (error) {
      log.warn(`Thumbnail generation failed for ${filePath}`, error);
    }
  }

  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(filePath, result);
  return result;
}
