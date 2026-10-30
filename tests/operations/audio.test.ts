import { describe, expect, it } from 'vitest';
import { after, audio, build, image, inputs, op, options, video } from '../helpers';

describe('extract-audio', () => {
  it('extracts the first audio track and encodes MP3', () => {
    const args = build('extract-audio', { format: 'mp3', bitrate: '256k' }, inputs([video()]));
    expect(args).toEqual(expect.arrayContaining(['-vn', '-map', '0:a:0']));
    expect(after(args, '-c:a')).toBe('libmp3lame');
    expect(after(args, '-b:a')).toBe('256k');
  });

  it('copies the original stream and picks a matching extension', () => {
    const args = build('extract-audio', { format: 'original' }, inputs([video()]));
    expect(after(args, '-c:a')).toBe('copy');
    const extract = op('extract-audio');
    expect(extract.outputExtension(options('extract-audio', { format: 'original' }), video({ audioCodec: 'opus' }))).toBe('opus');
    expect(extract.outputExtension(options('extract-audio', { format: 'original' }), video({ audioCodec: 'dts' }))).toBe('mka');
  });

  it('fails validation without audio', () => {
    expect(op('extract-audio').validate?.(options('extract-audio'), inputs([video({ hasAudio: false })]))).toMatch(/no audio/);
  });
});

describe('replace-audio', () => {
  it('maps video from the first input and audio from the second', () => {
    const args = build('replace-audio', {}, inputs([video()], { audio: [audio()] }));
    expect(args.slice(0, 4)).toEqual(['-i', '/media/clip.mp4', '-i', '/media/song.mp3']);
    expect(args).toEqual(expect.arrayContaining(['-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-shortest']));
    expect(after(args, '-c:a')).toBe('aac');
  });

  it('removes audio without re-encoding', () => {
    const args = build('replace-audio', { mode: 'remove' }, inputs([video()]));
    expect(args).toEqual(['-i', '/media/clip.mp4', '-map', '0', '-map', '-0:a', '-c', 'copy', '/out/result.ext']);
  });

  it('requires an audio file in replace mode', () => {
    expect(op('replace-audio').validate?.(options('replace-audio'), inputs([video()]))).toMatch(/Add an audio file/);
  });
});

describe('adjust-volume', () => {
  it('normalizes loudness with loudnorm and copies video', () => {
    const args = build('adjust-volume', { target: '-14' }, inputs([video()]));
    expect(after(args, '-filter:a')).toBe('loudnorm=I=-14:TP=-1.5:LRA=11');
    expect(after(args, '-c:v')).toBe('copy');
    expect(after(args, '-ar')).toBe('48000');
  });

  it('adjusts gain with an optional limiter', () => {
    expect(after(build('adjust-volume', { mode: 'adjust', gain: -6, limiter: false }, inputs([audio()])), '-filter:a')).toBe('volume=-6dB');
    expect(after(build('adjust-volume', { mode: 'adjust', gain: 6 }, inputs([audio()])), '-filter:a')).toBe(
      'volume=6dB,alimiter=limit=0.97:level=disabled',
    );
  });

  it('re-encodes audio-only files in their own format', () => {
    const args = build('adjust-volume', {}, inputs([audio()]));
    expect(args).toContain('-vn');
    expect(after(args, '-c:a')).toBe('libmp3lame');
  });
});

describe('audio-filters', () => {
  it('chains rumble removal, noise reduction and equalizer presets', () => {
    const args = build('audio-filters', { rumble: true, noiseReduction: 'strong', equalizer: 'bass' }, inputs([audio()]));
    expect(after(args, '-filter:a')).toBe('highpass=f=80,afftdn=nr=20:nf=-25,bass=g=6:f=110');
  });

  it('copies the video stream of video files', () => {
    const args = build('audio-filters', {}, inputs([video()]));
    expect(after(args, '-c:v')).toBe('copy');
    expect(after(args, '-filter:a')).toBe('afftdn=nr=12:nf=-30');
  });

  it('requires at least one active filter', () => {
    const message = op('audio-filters').validate?.(options('audio-filters', { noiseReduction: 'off' }), inputs([audio()]));
    expect(message).toMatch(/at least one/);
  });
});

describe('edit-metadata', () => {
  it('writes only filled tags and keeps streams untouched', () => {
    const args = build('edit-metadata', { title: 'Intro', year: '2024' }, inputs([audio()]));
    expect(args).toEqual(expect.arrayContaining(['-map', '0', '-c', 'copy', '-metadata', 'title=Intro', '-metadata', 'date=2024']));
    expect(args.filter((arg) => arg === '-metadata')).toHaveLength(2);
    expect(after(args, '-id3v2_version')).toBe('3');
  });

  it('embeds cover art as an attached picture', () => {
    const args = build('edit-metadata', { artist: 'Band' }, inputs([audio()], { cover: [image()] }));
    expect(args).toEqual(expect.arrayContaining(['-i', '/media/photo.png', '-map', '0:a', '-map', '1:0']));
    expect(after(args, '-disposition:v:0')).toBe('attached_pic');
  });

  it('can clear existing metadata', () => {
    expect(after(build('edit-metadata', { clearExisting: true }, inputs([audio()])), '-map_metadata')).toBe('-1');
  });

  it('validates cover support and input', () => {
    const validate = op('edit-metadata').validate;
    expect(validate?.(options('edit-metadata'), inputs([audio()]))).toMatch(/at least one/);
    expect(validate?.(options('edit-metadata'), inputs([audio({ ext: 'wav' })], { cover: [image()] }))).toMatch(/not supported/);
    expect(validate?.(options('edit-metadata', { year: 'last year' }), inputs([audio()]))).toMatch(/Year/);
  });
});
