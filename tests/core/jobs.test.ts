import { describe, expect, it } from 'vitest';
import { assembleArgs, formatCommand, splitArgs } from '@shared/jobs/command';
import { plannedOutputPath, renderFileName } from '@shared/jobs/output';
import { planJobs } from '@shared/jobs/plan';
import { ProgressParser, computeProgress } from '@shared/jobs/progress';
import { audio, image, op, options, subtitle, video } from '../helpers';

describe('planJobs', () => {
  it('creates one job per file and skips unsupported files', () => {
    const plan = planJobs(op('compress-video'), options('compress-video'), [video(), audio(), video({ id: 'v2' })], {});
    expect(plan.jobs).toHaveLength(2);
    expect(plan.skipped.map((file) => file.kind)).toEqual(['audio']);
    expect(plan.error).toBeNull();
  });

  it('combines every file into one job for merge and enforces minimum counts', () => {
    expect(planJobs(op('merge'), options('merge'), [video(), video({ id: 'v2' })], {}).jobs).toHaveLength(1);
    expect(planJobs(op('merge'), options('merge'), [video()], {}).error).toMatch(/at least 2/);
  });

  it('shares a single secondary file with every job', () => {
    const plan = planJobs(op('watermark'), options('watermark', { type: 'image' }), [video(), video({ id: 'v2' })], { image: [image()] });
    expect(plan.jobs.map((job) => job.extra.image?.[0]?.id)).toEqual(['i1', 'i1']);
  });

  it('pairs secondary files by order and rejects count mismatches', () => {
    const audios = [audio(), audio({ id: 'a2' })];
    const plan = planJobs(op('replace-audio'), options('replace-audio'), [video(), video({ id: 'v2' })], { audio: audios });
    expect(plan.jobs.map((job) => job.extra.audio?.[0]?.id)).toEqual(['a1', 'a2']);
    const mismatch = planJobs(op('replace-audio'), options('replace-audio'), [video()], { audio: audios });
    expect(mismatch.error).toMatch(/exactly one per job/);
  });

  it('gives every job all files for "all" slots and ignores hidden slots', () => {
    const subs = [subtitle(), subtitle({ id: 's2' })];
    const plan = planJobs(op('add-subtitles'), options('add-subtitles'), [video(), video({ id: 'v2' })], { subtitles: subs });
    expect(plan.jobs.every((job) => job.extra.subtitles?.length === 2)).toBe(true);
    const removal = planJobs(op('replace-audio'), options('replace-audio', { mode: 'remove' }), [video()], {});
    expect(removal.error).toBeNull();
  });

  it('reports a missing required slot', () => {
    expect(planJobs(op('add-subtitles'), options('add-subtitles'), [video()], {}).error).toMatch(/Subtitle files/);
  });
});

describe('output naming', () => {
  const date = new Date(2024, 4, 1);

  it('expands tokens and strips invalid characters', () => {
    expect(renderFileName('{name}_{op}_{index}_{date}', { name: 'clip', op: 'converted', ext: 'mp4', index: 3, date })).toBe(
      'clip_converted_3_2024-05-01',
    );
    expect(renderFileName('a:b*c?', { name: 'x', op: 'y', ext: 'mp4', index: 1, date })).toBe('a_b_c_');
    expect(renderFileName('   ', { name: 'clip', op: 'gif', ext: 'mp4', index: 1, date })).toBe('clip_gif');
  });

  it('writes next to the source by default with the operation extension', () => {
    const path = plannedOutputPath(
      op('video-to-gif'),
      options('video-to-gif'),
      { main: [video()], extra: {} },
      {
        directory: null,
        pattern: '{name}_{op}',
        overwrite: 'rename',
      },
      0,
    );
    expect(path).toBe('/media/clip_gif.gif');
  });

  it('adds a sequence pattern for frame extraction and avoids overwriting inputs', () => {
    const settings = { directory: 'D:\\out', pattern: '{name}', overwrite: 'rename' as const };
    const frames = plannedOutputPath(op('extract-frames'), options('extract-frames'), { main: [video()], extra: {} }, settings, 0);
    expect(frames).toBe('D:\\out\\clip_%04d.jpg');
    const same = plannedOutputPath(op('trim'), options('trim'), { main: [video()], extra: {} }, { ...settings, directory: '/media' }, 0);
    expect(same).toBe('/media/clip_output.mp4');
  });
});

describe('command assembly', () => {
  it('adds global flags and inserts extra args before the output', () => {
    expect(assembleArgs(['-i', 'in.mp4', 'out.mp4'], ['-threads', '2'])).toEqual([
      '-hide_banner',
      '-nostdin',
      '-y',
      '-progress',
      'pipe:1',
      '-nostats',
      '-i',
      'in.mp4',
      '-threads',
      '2',
      'out.mp4',
    ]);
  });

  it('splits extra arguments with quotes', () => {
    expect(splitArgs(`-metadata "title=My Movie" -vf 'scale=1280:-2'`).args).toEqual([
      '-metadata',
      'title=My Movie',
      '-vf',
      'scale=1280:-2',
    ]);
    expect(splitArgs('-a "" b').args).toEqual(['-a', '', 'b']);
    expect(splitArgs('"open').error).toMatch(/closing double quote/);
  });

  it('quotes arguments for display per platform', () => {
    expect(formatCommand(['ffmpeg', '-i', 'my file.mp4'], 'win32')).toBe('ffmpeg -i "my file.mp4"');
    expect(formatCommand(['ffmpeg', '-vf', "it's"], 'linux')).toBe(`ffmpeg -vf 'it'\\''s'`);
  });
});

describe('progress parsing', () => {
  it('parses blocks split across chunks', () => {
    const parser = new ProgressParser();
    expect(parser.push('frame=10\nout_time_us=5000000\nspe')).toEqual([]);
    expect(parser.push('ed=2.5x\nprogress=continue\n')).toEqual([{ outTime: 5, speed: 2.5, done: false }]);
    expect(parser.push('out_time_us=N/A\nout_time=00:00:10.000000\nspeed=N/A\nprogress=end\n')).toEqual([
      { outTime: 10, speed: null, done: true },
    ]);
  });

  it('computes percentage and ETA from speed or elapsed time', () => {
    expect(computeProgress({ outTime: 30, speed: 2, done: false }, 60, 15_000)).toMatchObject({ percent: 50, etaMs: 15_000 });
    expect(computeProgress({ outTime: 15, speed: null, done: false }, 60, 10_000)).toMatchObject({ percent: 25, etaMs: 30_000 });
    expect(computeProgress({ outTime: 15, speed: 1, done: false }, null, 1000).percent).toBeNull();
    expect(computeProgress({ outTime: 60, speed: 1, done: true }, 60, 1000)).toMatchObject({ percent: 100, etaMs: 0 });
  });
});
