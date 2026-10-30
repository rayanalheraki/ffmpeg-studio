import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { path as ffprobePath } from 'ffprobe-static';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assembleArgs } from '@shared/jobs/command';
import { probeArgs } from '@shared/operations/definitions/media-info';
import { getOperation } from '@shared/operations/registry';
import { getDefaultOptions } from '@shared/operations/schema';
import type { OptionValues } from '@shared/operations/types';
import type { MediaFile } from '@shared/types/media';
import { type RawProbe, toMediaFile } from '../../src/main/media/parse-probe';
import { findSystemFont } from '../../src/main/utils/fonts';

const ffmpeg = ffmpegPath ?? '';
let dir = '';
const media: Record<string, MediaFile> = {};

function run(binary: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(binary, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function generate(name: string, args: string[]): void {
  const result = run(ffmpeg, ['-hide_banner', '-y', ...args, join(dir, name)]);
  if (result.status !== 0) throw new Error(`Could not generate ${name}: ${result.stderr}`);
}

function probe(name: string): MediaFile {
  const file = join(dir, name);
  const result = run(ffprobePath, probeArgs(file));
  return toMediaFile(name, file, statSync(file).size, JSON.parse(result.stdout) as RawProbe);
}

interface Case {
  id: string;
  label?: string;
  options?: OptionValues;
  main: string[];
  extra?: Record<string, string[]>;
}

const CASES: Case[] = [
  { id: 'convert-format', options: { format: 'webm' }, main: ['clip.mp4'] },
  { id: 'convert-format', label: 'to flac', options: { format: 'flac' }, main: ['clip.mp4'] },
  { id: 'convert-format', label: 'to avi', options: { format: 'avi' }, main: ['clip.mp4'] },
  { id: 'compress-video', options: { codec: 'h265', maxHeight: '480', speed: 'fast' }, main: ['clip.mp4'] },
  { id: 'change-codec', options: { codec: 'av1', speed: 'fast', container: 'mkv' }, main: ['clip.mp4'] },
  { id: 'video-to-gif', options: { width: '320', duration: 1 }, main: ['clip.mp4'] },
  {
    id: 'images-to-video',
    options: { secondsPerImage: 1, resolution: '720' },
    main: ['logo.png', 'logo.png'],
    extra: { audio: ['tone.mp3'] },
  },
  { id: 'trim', options: { start: '00:00:00.5', end: '00:00:01.5', mode: 'accurate' }, main: ['clip.mp4'] },
  { id: 'merge', main: ['clip.mp4', 'silent.mp4'] },
  { id: 'merge', label: 'audio', options: { format: 'mp3' }, main: ['tone.mp3', 'tone.mp3'] },
  {
    id: 'resize',
    options: { preset: 'custom', size: { width: 200, height: 100, lockAspect: false }, noUpscale: false },
    main: ['clip.mp4'],
  },
  { id: 'resize', label: 'image', options: { preset: '480', noUpscale: false }, main: ['logo.png'] },
  { id: 'crop', options: { aspect: '9:16' }, main: ['clip.mp4'] },
  { id: 'rotate-flip', options: { rotation: '90', flipVertical: true }, main: ['clip.mp4'] },
  { id: 'change-speed', options: { speed: 0.25 }, main: ['clip.mp4'] },
  { id: 'change-fps', options: { fps: '29.97', method: 'blend' }, main: ['clip.mp4'] },
  { id: 'extract-audio', options: { format: 'original' }, main: ['clip.mp4'] },
  { id: 'replace-audio', main: ['clip.mp4'], extra: { audio: ['tone.mp3'] } },
  { id: 'replace-audio', label: 'remove', options: { mode: 'remove' }, main: ['clip.mp4'] },
  { id: 'adjust-volume', options: { mode: 'adjust', gain: 6 }, main: ['tone.mp3'] },
  { id: 'adjust-volume', label: 'normalize', main: ['clip.mp4'] },
  { id: 'audio-filters', options: { rumble: true, equalizer: 'voice' }, main: ['tone.mp3'] },
  { id: 'edit-metadata', options: { title: "It's: a test", year: '2024' }, main: ['tone.mp3'], extra: { cover: ['logo.png'] } },
  { id: 'video-filters', options: { brightness: 10, saturation: 150, denoise: 'light', stabilize: true }, main: ['clip.mp4'] },
  { id: 'watermark', options: { text: "Studio's 100%: [test], ok;" }, main: ['clip.mp4'] },
  { id: 'watermark', label: 'image', options: { type: 'image', position: 'top-left' }, main: ['clip.mp4'], extra: { image: ['logo.png'] } },
  { id: 'add-subtitles', main: ['clip.mp4'], extra: { subtitles: ['subs, [en].srt'] } },
  { id: 'add-subtitles', label: 'burn', options: { mode: 'burn' }, main: ['clip.mp4'], extra: { subtitles: ['subs, [en].srt'] } },
  { id: 'extract-subtitles', main: ['subtitled.mkv'] },
  { id: 'extract-frames', options: { interval: 1 }, main: ['clip.mp4'] },
  { id: 'extract-frames', label: 'single', options: { mode: 'timestamp', timestamp: '1', format: 'png' }, main: ['clip.mp4'] },
];

describe.skipIf(!ffmpegPath)('operations against the bundled FFmpeg', () => {
  beforeAll(() => {
    // A folder name with spaces, quotes and a colon-free apostrophe exercises path escaping.
    dir = mkdtempSync(join(tmpdir(), "ffmpeg studio's test "));
    generate('clip.mp4', [
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=320x240:rate=25:duration=3',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=3',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
    ]);
    generate('silent.mp4', ['-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p']);
    generate('tone.mp3', ['-f', 'lavfi', '-i', 'sine=frequency=220:duration=3', '-c:a', 'libmp3lame']);
    generate('logo.png', ['-f', 'lavfi', '-i', 'color=c=orange:size=64x64', '-frames:v', '1']);
    writeFileSync(join(dir, 'subs, [en].srt'), '1\n00:00:00,000 --> 00:00:02,000\nHello, world\n', 'utf8');
    generate('subtitled.mkv', ['-i', join(dir, 'clip.mp4'), '-i', join(dir, 'subs, [en].srt'), '-map', '0', '-map', '1', '-c', 'copy']);
    for (const name of ['clip.mp4', 'silent.mp4', 'tone.mp3', 'logo.png', 'subs, [en].srt', 'subtitled.mkv']) media[name] = probe(name);
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it.each(CASES.map((c) => [`${c.id}${c.label ? ` (${c.label})` : ''}`, c] as const))('%s', (_name, testCase) => {
    const operation = getOperation(testCase.id);
    if (!operation) throw new Error(`Unknown operation ${testCase.id}`);
    const options = { ...getDefaultOptions(operation), ...testCase.options };
    const files = testCase.main.map((name) => media[name] as MediaFile);
    const extra = Object.fromEntries(
      Object.entries(testCase.extra ?? {}).map(([slot, names]) => [slot, names.map((n) => media[n] as MediaFile)]),
    );
    const inputs = { main: files, extra };
    expect(operation.validate?.(options, inputs) ?? null).toBeNull();

    const primary = files[0] as MediaFile;
    const sequence = operation.outputSequence?.(options) ?? false;
    const base = `${testCase.id}-${testCase.label ?? 'default'}`.replace(/\s/g, '_');
    const output = join(dir, `${base}${sequence ? '_%04d' : ''}.${operation.outputExtension(options, primary)}`);
    const args = assembleArgs(operation.buildArgs(options, inputs, { output, fontFile: findSystemFont() }));

    const result = run(ffmpeg, args);
    expect(result.status, result.stderr.split('\n').slice(-15).join('\n')).toBe(0);
    expect(result.stdout).toContain('progress=end');
    if (sequence) expect(readdirSync(dir).filter((f) => f.startsWith(base)).length).toBeGreaterThan(1);
    else expect(existsSync(output) && statSync(output).size > 0).toBe(true);
  });
});
