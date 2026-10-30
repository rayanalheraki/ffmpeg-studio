import { describe, expect, it } from 'vitest';
import { OUTPUT, after, audio, build, image, inputs, op, options, video } from '../helpers';

describe('convert-format', () => {
  it('encodes MP4 with H.264, AAC and faststart', () => {
    const args = build('convert-format', { format: 'mp4', quality: 'high' }, inputs([video({ ext: 'mkv' })]));
    expect(args.slice(0, 2)).toEqual(['-i', '/media/clip.mp4']);
    expect(after(args, '-c:v')).toBe('libx264');
    expect(after(args, '-crf')).toBe('18');
    expect(after(args, '-c:a')).toBe('aac');
    expect(after(args, '-movflags')).toBe('+faststart');
    expect(args.at(-1)).toBe(OUTPUT);
  });

  it('uses VP9 and Opus for WebM', () => {
    const args = build('convert-format', { format: 'webm' }, inputs([video()]));
    expect(after(args, '-c:v')).toBe('libvpx-vp9');
    expect(after(args, '-c:a')).toBe('libopus');
    expect(args).not.toContain('-movflags');
  });

  it('uses MPEG-4 and MP3 for AVI', () => {
    const args = build('convert-format', { format: 'avi', quality: 'small' }, inputs([video()]));
    expect(after(args, '-c:v')).toBe('mpeg4');
    expect(after(args, '-q:v')).toBe('7');
    expect(after(args, '-c:a')).toBe('libmp3lame');
  });

  it('drops video for audio targets and applies the bitrate', () => {
    const args = build('convert-format', { format: 'mp3', audioBitrate: '320k' }, inputs([video()]));
    expect(args).toContain('-vn');
    expect(after(args, '-c:a')).toBe('libmp3lame');
    expect(after(args, '-b:a')).toBe('320k');
  });

  it('writes AAC into .m4a and lossless formats without a bitrate', () => {
    const conversion = op('convert-format');
    expect(conversion.outputExtension(options('convert-format', { format: 'aac' }), audio())).toBe('m4a');
    const flac = build('convert-format', { format: 'flac' }, inputs([audio()]));
    expect(after(flac, '-c:a')).toBe('flac');
    expect(flac).not.toContain('-b:a');
  });

  it('skips the video encoder for audio-only sources', () => {
    const args = build('convert-format', { format: 'mkv' }, inputs([audio()]));
    expect(args).not.toContain('-c:v');
    expect(after(args, '-c:a')).toBe('aac');
  });
});

describe('compress-video', () => {
  it('maps quality presets to CRF values per codec', () => {
    expect(after(build('compress-video', { quality: 'small' }, inputs([video()])), '-crf')).toBe('28');
    expect(after(build('compress-video', { codec: 'h265', quality: 'high' }, inputs([video()])), '-crf')).toBe('22');
  });

  it('uses the custom CRF slider value', () => {
    const args = build('compress-video', { quality: 'custom', crf: 31 }, inputs([video()]));
    expect(after(args, '-crf')).toBe('31');
  });

  it('tags H.265 as hvc1 in MP4 and maps encoding speed', () => {
    const args = build('compress-video', { codec: 'h265', speed: 'fast' }, inputs([video()]));
    expect(after(args, '-c:v')).toBe('libx265');
    expect(after(args, '-tag:v')).toBe('hvc1');
    expect(after(args, '-preset')).toBe('veryfast');
  });

  it('limits resolution without upscaling', () => {
    const args = build('compress-video', { maxHeight: '720' }, inputs([video()]));
    expect(after(args, '-vf')).toBe("scale=-2:'min(ih,720)'");
  });

  it('falls back to MP4 for containers it does not keep', () => {
    expect(op('compress-video').outputExtension(options('compress-video'), video({ ext: 'avi' }))).toBe('mp4');
  });
});

describe('change-codec', () => {
  it('encodes AV1 with libaom and copies compatible audio', () => {
    const args = build('change-codec', { codec: 'av1', container: 'mkv' }, inputs([video()]));
    expect(after(args, '-c:v')).toBe('libaom-av1');
    expect(after(args, '-b:v')).toBe('0');
    expect(after(args, '-c:a')).toBe('copy');
  });

  it('re-encodes audio that WebM cannot hold', () => {
    const args = build('change-codec', { codec: 'vp9', container: 'webm' }, inputs([video()]));
    expect(after(args, '-c:a')).toBe('libopus');
  });

  it('chooses WebM automatically for VP9 from an MOV source', () => {
    const definition = op('change-codec');
    expect(definition.outputExtension(options('change-codec', { codec: 'vp9' }), video({ ext: 'mov' }))).toBe('webm');
  });

  it('rejects H.264 in WebM', () => {
    const message = op('change-codec').validate?.(options('change-codec', { codec: 'h264', container: 'webm' }), inputs([video()]));
    expect(message).toMatch(/WebM/);
  });
});

describe('video-to-gif', () => {
  it('builds a palettegen/paletteuse graph with fps and width', () => {
    const args = build('video-to-gif', { fps: 15, width: '640', dither: 'bayer' }, inputs([video()]));
    const graph = after(args, '-filter_complex');
    expect(graph).toContain('[0:v]fps=15,scale=640:-1:flags=lanczos,split[s0][s1]');
    expect(graph).toContain('palettegen=stats_mode=diff');
    expect(graph).toContain('paletteuse=dither=bayer');
    expect(after(args, '-loop')).toBe('0');
  });

  it('seeks and limits length before the input', () => {
    const args = build('video-to-gif', { start: '00:00:05', duration: 3, loop: false }, inputs([video()]));
    expect(args.slice(0, 5)).toEqual(['-ss', '00:00:05.000', '-t', '3', '-i']);
    expect(after(args, '-loop')).toBe('-1');
  });

  it('reports the clip length as the expected duration', () => {
    const definition = op('video-to-gif');
    expect(definition.expectedDuration?.(options('video-to-gif', { start: '10' }), inputs([video()]))).toBe(50);
  });
});

describe('images-to-video', () => {
  const images = [image(), image({ id: 'i2', path: '/media/two.jpg', ext: 'jpg' })];

  it('loops each image for the chosen duration and concatenates them', () => {
    const args = build('images-to-video', { secondsPerImage: 2, fps: '25' }, inputs(images));
    expect(args.filter((arg) => arg === '-loop')).toHaveLength(2);
    expect(after(args, '-t')).toBe('2');
    const graph = after(args, '-filter_complex') ?? '';
    expect(graph).toContain('[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080');
    expect(graph).toContain('[v0][v1]concat=n=2:v=1:a=0[outv]');
    expect(after(args, '-r')).toBe('25');
  });

  it('crops to fill in cover mode and matches the first image size', () => {
    const graph = after(build('images-to-video', { fit: 'cover', resolution: 'first' }, inputs(images)), '-filter_complex');
    expect(graph).toContain('scale=800:600:force_original_aspect_ratio=increase,crop=800:600');
  });

  it('adds an optional soundtrack and ends with the shortest stream', () => {
    const args = build('images-to-video', {}, inputs(images, { audio: [audio()] }));
    expect(args).toContain('/media/song.mp3');
    expect(args).toContain('2:a:0');
    expect(args).toContain('-shortest');
  });

  it('expects images × seconds of output', () => {
    expect(op('images-to-video').expectedDuration?.(options('images-to-video'), inputs(images))).toBe(6);
  });
});
