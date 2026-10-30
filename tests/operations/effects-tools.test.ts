import { describe, expect, it } from 'vitest';
import { OUTPUT, after, build, image, inputs, op, options, subtitle, video } from '../helpers';

describe('video-filters', () => {
  it('chains stabilize, denoise and eq in order', () => {
    const args = build(
      'video-filters',
      { stabilize: true, denoise: 'light', brightness: 10, contrast: 120, saturation: 50 },
      inputs([video()]),
    );
    expect(after(args, '-vf')).toBe('deshake,hqdn3d=2:1.5:3:2.25,eq=brightness=0.1:contrast=1.2:saturation=0.5');
  });

  it('only includes eq parameters that changed', () => {
    expect(after(build('video-filters', { saturation: 150 }, inputs([video()])), '-vf')).toBe('eq=saturation=1.5');
  });

  it('requires a change', () => {
    expect(op('video-filters').validate?.(options('video-filters'), inputs([video()]))).toMatch(/at least one/);
  });
});

describe('watermark', () => {
  it('draws escaped text with a font file, size and position', () => {
    const args = build(
      'watermark',
      { text: "It's 50% off: now", position: 'top-left', size: 10 },
      inputs([video()]),
      'C:\\Windows\\Fonts\\arial.ttf',
    );
    const filter = after(args, '-vf') ?? '';
    expect(filter).toContain('fontfile=C\\\\:/Windows/Fonts/arial.ttf');
    expect(filter).toContain("text=It\\\\\\'s 50% off\\\\: now");
    expect(filter).toContain('expansion=none');
    expect(filter).toContain('fontsize=108');
    expect(filter).toContain('fontcolor=0xFFFFFF@0.8');
    expect(filter).toContain('x=24:y=24');
  });

  it('places text at the bottom-right by default', () => {
    expect(after(build('watermark', {}, inputs([video()])), '-vf')).toContain('x=w-text_w-24:y=h-text_h-24');
  });

  it('overlays an image scaled relative to the video width', () => {
    const args = build('watermark', { type: 'image', size: 20, opacity: 50, position: 'center' }, inputs([video()], { image: [image()] }));
    const graph = after(args, '-filter_complex') ?? '';
    expect(graph).toContain('[1:v]format=rgba,scale=384:-1,colorchannelmixer=aa=0.5[wm]');
    expect(graph).toContain('overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2');
    expect(args).toEqual(expect.arrayContaining(['-map', '[outv]', '-map', '0:a?']));
  });

  it('validates text and image inputs', () => {
    const validate = op('watermark').validate;
    expect(validate?.(options('watermark', { text: '  ' }), inputs([video()]))).toMatch(/Enter/);
    expect(validate?.(options('watermark', { type: 'image' }), inputs([video()]))).toMatch(/Add a watermark/);
  });
});

describe('add-subtitles', () => {
  it('adds soft subtitle tracks with language metadata', () => {
    const subs = [subtitle(), subtitle({ id: 's2', path: '/media/clip.es.srt' })];
    const args = build('add-subtitles', { language: 'spa' }, inputs([video({ subtitleStreams: 1 })], { subtitles: subs }));
    expect(args).toEqual(expect.arrayContaining(['-map', '1:0', '-map', '2:0', '-c', 'copy']));
    expect(after(args, '-c:s:1')).toBe('mov_text');
    expect(after(args, '-c:s:2')).toBe('mov_text');
    expect(after(args, '-metadata:s:s:1')).toBe('language=spa');
    expect(after(args, '-disposition:s:1')).toBe('default');
  });

  it('burns the first subtitle with an escaped path', () => {
    const args = build(
      'add-subtitles',
      { mode: 'burn', fontSize: 30 },
      inputs([video()], { subtitles: [subtitle({ path: 'C:\\subs\\a.srt' })] }),
    );
    expect(after(args, '-vf')).toBe('subtitles=filename=C\\\\:/subs/a.srt:force_style=FontSize=30');
    expect(after(args, '-c:v')).toBe('libx264');
  });

  it('keeps soft subtitles in MKV for unsupported containers', () => {
    expect(op('add-subtitles').outputExtension(options('add-subtitles'), video({ ext: 'avi' }))).toBe('mkv');
  });
});

describe('extract-subtitles', () => {
  it('maps the chosen subtitle track and converts it', () => {
    const args = build('extract-subtitles', { track: 1, format: 'vtt' }, inputs([video({ subtitleStreams: 2 })]));
    expect(args).toEqual(['-i', '/media/clip.mp4', '-map', '0:s:1', '-c:s', 'webvtt', OUTPUT]);
  });

  it('validates the track exists', () => {
    const validate = op('extract-subtitles').validate;
    expect(validate?.(options('extract-subtitles'), inputs([video()]))).toMatch(/no subtitle/);
    expect(validate?.(options('extract-subtitles', { track: 3 }), inputs([video({ subtitleStreams: 2 })]))).toMatch(/only has 2/);
  });
});

describe('extract-frames', () => {
  it('extracts a frame every N seconds as an image sequence', () => {
    const args = build('extract-frames', { interval: 2, width: '640' }, inputs([video()]));
    expect(after(args, '-vf')).toBe('fps=1/2,scale=640:-2');
    expect(after(args, '-q:v')).toBe('2');
    expect(op('extract-frames').outputSequence?.(options('extract-frames'))).toBe(true);
  });

  it('extracts a single frame at a timestamp', () => {
    const args = build('extract-frames', { mode: 'timestamp', timestamp: '1:30', format: 'png' }, inputs([video()]));
    expect(args.slice(0, 4)).toEqual(['-ss', '00:01:30.000', '-i', '/media/clip.mp4']);
    expect(after(args, '-frames:v')).toBe('1');
    expect(op('extract-frames').outputSequence?.(options('extract-frames', { mode: 'timestamp' }))).toBe(false);
  });

  it('rejects timestamps past the end', () => {
    const message = op('extract-frames').validate?.(
      options('extract-frames', { mode: 'timestamp', timestamp: '02:00' }),
      inputs([video()]),
    );
    expect(message).toMatch(/beyond/);
  });
});

describe('media-info', () => {
  it('runs FFprobe with JSON output', () => {
    const args = build('media-info', {}, inputs([video()]));
    expect(args).toEqual(['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '-show_chapters', '/media/clip.mp4']);
    expect(op('media-info').mode).toBe('inspect');
  });
});
