import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { summarizeFailure } from '../../src/main/ffmpeg/errors';
import { appendLog } from '../../src/main/ffmpeg/runner';
import { parseFrameRate, toMediaFile } from '../../src/main/media/parse-probe';
import { resolveOutputPath } from '../../src/main/queue/output-path';
import { sanitizePatch } from '../../src/main/settings/sanitize';

describe('FFprobe parsing', () => {
  it('reads streams, ignores cover art as video and parses frame rates', () => {
    const file = toMediaFile('id', '/music/song.mp3', 1234, {
      format: { format_name: 'mp3', duration: '200.5', bit_rate: '320000' },
      streams: [
        { index: 0, codec_type: 'audio', codec_name: 'mp3' },
        { index: 1, codec_type: 'video', codec_name: 'mjpeg', width: 500, height: 500, disposition: { attached_pic: 1 } },
      ],
    });
    expect(file).toMatchObject({ kind: 'audio', hasAudio: true, hasVideo: false, duration: 200.5, width: null, bitRate: 320000 });
    expect(parseFrameRate('30000/1001')).toBe(29.97);
    expect(parseFrameRate('0/0')).toBeNull();
  });

  it('treats still images as images without duration', () => {
    const file = toMediaFile('id', '/p/photo.png', 10, {
      format: { duration: '0.04' },
      streams: [{ codec_type: 'video', codec_name: 'png', width: 640, height: 480, avg_frame_rate: '25/1' }],
    });
    expect(file).toMatchObject({ kind: 'image', hasVideo: false, duration: null, width: 640, fps: null });
  });
});

describe('failure summaries', () => {
  it('maps known FFmpeg errors to friendly messages', () => {
    expect(summarizeFailure('in.mp4: No such file or directory', 1)).toMatch(/could not be found/);
    expect(summarizeFailure("Stream map '0:a:0' matches no streams.", 1)).toMatch(/does not contain the stream/);
  });

  it('falls back to the last meaningful line', () => {
    expect(summarizeFailure('Input #0\nSomething odd happened\n', 69)).toBe('FFmpeg failed (exit code 69). Something odd happened');
  });

  it('caps the stored log length', () => {
    const log = appendLog('', 'x'.repeat(600 * 1024));
    expect(log.length).toBeLessThan(600 * 1024);
    expect(log.startsWith('[earlier output truncated]')).toBe(true);
  });
});

describe('output collisions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ffmpeg-studio-'));
  const existing = join(dir, 'clip.mp4');
  writeFileSync(existing, '');

  it('renames, skips or overwrites existing files', () => {
    expect(resolveOutputPath(existing, 'rename', new Set()).path).toBe(join(dir, 'clip (1).mp4'));
    expect(resolveOutputPath(existing, 'skip', new Set()).skipReason).toMatch(/already exists/);
    expect(resolveOutputPath(existing, 'overwrite', new Set())).toEqual({ path: existing, skipReason: null });
  });

  it('never lets two pending jobs share an output', () => {
    const planned = join(dir, 'new.mp4');
    const reserved = new Set([planned.toLowerCase()]);
    expect(resolveOutputPath(planned, 'overwrite', reserved).path).toBe(join(dir, 'new (1).mp4'));
  });
});

describe('settings sanitization', () => {
  it('drops unknown fields and clamps values', () => {
    const patch = sanitizePatch({ theme: 'neon', concurrency: 99, queueOpen: false, hacked: true, lastOperationId: 'nope' });
    expect(patch).toEqual({ concurrency: 8, queueOpen: false });
  });

  it('normalizes stored options per operation', () => {
    const patch = sanitizePatch({ lastOptions: { trim: { mode: 'weird' }, unknown: {} } });
    expect(patch.lastOptions).toEqual({ trim: { start: '00:00:00', end: '', mode: 'fast' } });
  });
});
