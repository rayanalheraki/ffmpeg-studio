import { describe, expect, it } from 'vitest';
import { after, audio, build, image, inputs, op, options, video } from '../helpers';

describe('trim', () => {
  it('stream-copies in fast mode with input seeking', () => {
    const args = build('trim', { start: '00:00:10', end: '00:00:25' }, inputs([video()]));
    expect(args.slice(0, 4)).toEqual(['-ss', '00:00:10.000', '-i', '/media/clip.mp4']);
    expect(after(args, '-t')).toBe('00:00:15.000');
    expect(after(args, '-c')).toBe('copy');
  });

  it('re-encodes for frame-accurate cuts', () => {
    const args = build('trim', { start: '5', end: '8.5', mode: 'accurate' }, inputs([video()]));
    expect(after(args, '-c:v')).toBe('libx264');
    expect(after(args, '-t')).toBe('00:00:03.500');
  });

  it('trims to the end of the file when no end time is set', () => {
    const args = build('trim', { start: '00:01:00', end: '' }, inputs([audio()]));
    expect(args).not.toContain('-t');
    expect(op('trim').expectedDuration?.(options('trim', { start: '00:01:00', end: '' }), inputs([audio()]))).toBe(120);
  });

  it('validates the time range', () => {
    const validate = op('trim').validate;
    expect(validate?.(options('trim', { start: '20', end: '10' }), inputs([video()]))).toMatch(/after the start/);
    expect(validate?.(options('trim', { start: 'abc' }), inputs([video()]))).toMatch(/not a valid/);
    expect(validate?.(options('trim', { start: '90' }), inputs([video()]))).toMatch(/beyond/);
  });
});

describe('merge', () => {
  const clips = [video(), video({ id: 'v2', path: '/media/b.mp4', width: 1280, height: 720 })];

  it('scales every clip to the first clip and concatenates video and audio', () => {
    const args = build('merge', {}, inputs(clips));
    const graph = after(args, '-filter_complex') ?? '';
    expect(graph).toContain('[1:v:0]scale=1920:1080:force_original_aspect_ratio=decrease');
    expect(graph).toContain('[v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]');
    expect(args).toContain('[outv]');
    expect(args).toContain('[outa]');
  });

  it('generates silence for clips without audio', () => {
    const silent = video({ id: 'v3', path: '/media/silent.mp4', hasAudio: false, duration: 12 });
    const args = build('merge', {}, inputs([video(), silent]));
    expect(args).toContain('anullsrc=channel_layout=stereo:sample_rate=48000');
    expect(after(args, '-t')).toBe('12');
    expect(after(args, '-filter_complex')).toContain('[2:a]aresample=48000');
  });

  it('merges audio only when the output is an audio format', () => {
    const args = build('merge', { format: 'mp3' }, inputs([audio(), audio({ id: 'a2', path: '/media/b.mp3' })]));
    expect(after(args, '-filter_complex')).toContain('concat=n=2:v=0:a=1[outa]');
    expect(args).not.toContain('[outv]');
    expect(after(args, '-c:a')).toBe('libmp3lame');
  });

  it('requires video in every file for video output and sums durations', () => {
    const merge = op('merge');
    expect(merge.validate?.(options('merge', { format: 'mp4' }), inputs([video(), audio()]))).toMatch(/must contain video/);
    expect(merge.expectedDuration?.(options('merge'), inputs(clips))).toBe(120);
    expect(merge.outputExtension(options('merge'), audio({ ext: 'ogg' }))).toBe('mp3');
  });
});

describe('resize', () => {
  it('scales to preset heights without upscaling by default', () => {
    expect(after(build('resize', { preset: '720' }, inputs([video()])), '-vf')).toBe("scale=-2:'min(ih,720)':flags=lanczos");
    expect(after(build('resize', { preset: '2160', noUpscale: false }, inputs([video()])), '-vf')).toBe('scale=-2:2160:flags=lanczos');
  });

  it('keeps the aspect ratio for locked custom sizes', () => {
    const args = build(
      'resize',
      { preset: 'custom', size: { width: 1001, height: 500, lockAspect: true }, noUpscale: false },
      inputs([video()]),
    );
    expect(after(args, '-vf')).toBe('scale=1002:-2:flags=lanczos');
  });

  it('forces exact dimensions when unlocked', () => {
    const args = build(
      'resize',
      { preset: 'custom', size: { width: 640, height: 640, lockAspect: false }, noUpscale: false },
      inputs([video()]),
    );
    expect(after(args, '-vf')).toBe('scale=640:640:flags=lanczos,setsar=1');
  });

  it('writes a single high-quality frame for images', () => {
    const args = build('resize', {}, inputs([image({ ext: 'jpg', path: '/media/p.jpg' })]));
    expect(after(args, '-q:v')).toBe('2');
    expect(after(args, '-frames:v')).toBe('1');
    expect(op('resize').outputExtension(options('resize'), image())).toBe('png');
  });
});

describe('crop', () => {
  it('crops to an aspect ratio using the largest centered area', () => {
    const filter = after(build('crop', { aspect: '9:16' }, inputs([video()])), '-vf');
    expect(filter).toBe("crop=w='trunc(min(iw,ih*9/16)/2)*2':h='trunc(min(ih,iw*16/9)/2)*2'");
  });

  it('crops an exact region with offsets', () => {
    const args = build('crop', { mode: 'custom', width: 640, height: 360, center: false, x: 10, y: 20 }, inputs([video()]));
    expect(after(args, '-vf')).toBe('crop=640:360:10:20');
  });

  it('rejects a region larger than the source', () => {
    const message = op('crop').validate?.(options('crop', { mode: 'custom', width: 4000, height: 100 }), inputs([video()]));
    expect(message).toMatch(/larger than/);
  });
});

describe('rotate-flip', () => {
  it('maps rotations to transpose and flips', () => {
    expect(after(build('rotate-flip', { rotation: '90' }, inputs([video()])), '-vf')).toBe('transpose=clock');
    expect(after(build('rotate-flip', { rotation: '270' }, inputs([video()])), '-vf')).toBe('transpose=cclock');
    expect(after(build('rotate-flip', { rotation: '180', flipHorizontal: true }, inputs([video()])), '-vf')).toBe('hflip,vflip,hflip');
  });

  it('requires at least one transformation', () => {
    expect(op('rotate-flip').validate?.(options('rotate-flip', { rotation: '0' }), inputs([video()]))).toMatch(/Choose/);
  });
});

describe('change-speed', () => {
  it('changes video timestamps and chains atempo for extreme speeds', () => {
    const args = build('change-speed', { speed: 4 }, inputs([video()]));
    expect(after(args, '-filter:v')).toBe('setpts=PTS/4');
    expect(after(args, '-filter:a')).toBe('atempo=2,atempo=2');
    expect(after(build('change-speed', { speed: 0.25 }, inputs([video()])), '-filter:a')).toBe('atempo=0.5,atempo=0.5');
  });

  it('can drop audio and handles audio-only files', () => {
    expect(build('change-speed', { audio: 'mute' }, inputs([video()]))).toContain('-an');
    const args = build('change-speed', { speed: 1.25 }, inputs([audio()]));
    expect(args).toContain('-vn');
    expect(after(args, '-filter:a')).toBe('atempo=1.25');
  });

  it('shortens the expected duration and rejects 1x', () => {
    const speed = op('change-speed');
    expect(speed.expectedDuration?.(options('change-speed', { speed: 2 }), inputs([video()]))).toBe(30);
    expect(speed.validate?.(options('change-speed', { speed: 1 }), inputs([video()]))).toMatch(/other than 1x/);
  });
});

describe('change-fps', () => {
  it('uses exact fractions for NTSC rates', () => {
    expect(after(build('change-fps', { fps: '29.97' }, inputs([video()])), '-vf')).toBe('fps=30000/1001');
  });

  it('blends frames or uses a custom rate', () => {
    expect(after(build('change-fps', { fps: 'custom', customFps: 48, method: 'blend' }, inputs([video()])), '-vf')).toBe(
      'framerate=fps=48',
    );
  });

  it('copies compatible audio', () => {
    expect(after(build('change-fps', {}, inputs([video()])), '-c:a')).toBe('copy');
  });
});
