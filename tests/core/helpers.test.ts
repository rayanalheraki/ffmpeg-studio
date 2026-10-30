import { describe, expect, it } from 'vitest';
import { kindFromExtension, extensionOf } from '@shared/media/kinds';
import { atempoChain, escapeFilterPath, escapeFilterValue, ffmpegColor, overlayPosition } from '@shared/operations/helpers/filters';
import { normalizeOptions } from '@shared/operations/schema';
import { dirname, joinPath } from '@shared/utils/path';
import { formatDuration, parseTime, toFfmpegTime } from '@shared/utils/time';
import { op } from '../helpers';

describe('time helpers', () => {
  it('parses common timestamp forms', () => {
    expect(parseTime('90')).toBe(90);
    expect(parseTime('1:30')).toBe(90);
    expect(parseTime('01:02:03.5')).toBe(3723.5);
    expect(parseTime('')).toBeNull();
    expect(parseTime('1:75')).toBeNull();
    expect(parseTime('abc')).toBeNull();
  });

  it('formats for FFmpeg and for display', () => {
    expect(toFfmpegTime(3723.5)).toBe('01:02:03.500');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(null)).toBe('--:--');
  });
});

describe('filter helpers', () => {
  it('escapes values for both filtergraph levels', () => {
    expect(escapeFilterValue('a:b')).toBe('a\\\\:b');
    expect(escapeFilterValue("it's")).toBe("it\\\\\\'s");
    expect(escapeFilterValue('x,y;[z]')).toBe('x\\,y\\;\\[z\\]');
    expect(escapeFilterPath('C:\\Users\\me\\sub.srt')).toBe('C\\\\:/Users/me/sub.srt');
  });

  it('converts colors and anchors', () => {
    expect(ffmpegColor('#ff8800', 0.5)).toBe('0xFF8800@0.5');
    expect(ffmpegColor('not a color')).toBe('0xFFFFFF');
    expect(overlayPosition('top-right', 10)).toEqual({ x: 'main_w-overlay_w-10', y: '10' });
    expect(overlayPosition('bottom', 0)).toEqual({ x: '(main_w-overlay_w)/2', y: 'main_h-overlay_h-0' });
  });

  it('keeps every atempo stage within 0.5–2', () => {
    expect(atempoChain(3)).toBe('atempo=2,atempo=1.5');
    expect(atempoChain(0.3)).toBe('atempo=0.5,atempo=0.6');
  });
});

describe('option normalization', () => {
  it('coerces, clamps and fills defaults for untrusted input', () => {
    const normalized = normalizeOptions(op('compress-video'), { crf: 99, codec: 'bogus', speed: 'slow', extra: 'dropped' });
    expect(normalized).toMatchObject({ crf: 51, codec: 'h264', speed: 'slow', quality: 'balanced' });
    expect(normalized).not.toHaveProperty('extra');
  });

  it('validates colors, anchors and dimensions', () => {
    const watermark = normalizeOptions(op('watermark'), { color: 'red', position: 'middle' });
    expect(watermark).toMatchObject({ color: '#ffffff', position: 'bottom-right' });
    const resize = normalizeOptions(op('resize'), { size: { width: 99999, height: 1.6, lockAspect: false } });
    expect(resize.size).toEqual({ width: 8192, height: 16, lockAspect: false });
  });
});

describe('path and kind helpers', () => {
  it('handles Windows and POSIX paths', () => {
    expect(dirname('C:\\videos\\a.mp4')).toBe('C:\\videos');
    expect(dirname('C:\\a.mp4')).toBe('C:\\');
    expect(dirname('/home/me/a.mp4')).toBe('/home/me');
    expect(joinPath('C:\\videos', 'b.mp4')).toBe('C:\\videos\\b.mp4');
    expect(joinPath('/home/', 'b.mp4')).toBe('/home/b.mp4');
  });

  it('classifies files by extension', () => {
    expect(extensionOf('/a/B.MKV')).toBe('mkv');
    expect(kindFromExtension('flac')).toBe('audio');
    expect(kindFromExtension('vtt')).toBe('subtitle');
    expect(kindFromExtension('xyz')).toBe('unknown');
  });
});
