import { defineOperation } from '../types';
import { audioEncoderFor, containerFlags, videoEncoderArgs } from '../helpers/encoders';
import { even, ffmpegColor } from '../helpers/filters';
import { extraFiles, primaryFile } from '../helpers/streams';

type Options = {
  secondsPerImage: number;
  fps: string;
  resolution: string;
  fit: string;
  background: string;
  format: string;
};

const RESOLUTIONS: Record<string, [number, number]> = {
  '2160': [3840, 2160],
  '1080': [1920, 1080],
  '720': [1280, 720],
  square: [1080, 1080],
  vertical: [1080, 1920],
};

export default defineOperation<Options>({
  id: 'images-to-video',
  label: 'Images to video',
  description: 'Turn a set of images into a slideshow video, with optional music.',
  category: 'convert',
  icon: 'Images',
  order: 5,
  batch: 'combine',
  input: { accept: ['image'], label: 'Images (in order)' },
  extraSlots: [
    {
      id: 'audio',
      label: 'Soundtrack',
      description: 'Optional. The video ends when the shorter of images or audio ends.',
      accept: ['audio'],
      multiple: false,
      distribution: 'paired',
      requiredWhen: () => false,
    },
  ],
  outputSuffix: 'slideshow',
  options: [
    {
      key: 'secondsPerImage',
      type: 'slider',
      label: 'Seconds per image',
      min: 0.5,
      max: 20,
      step: 0.5,
      default: 3,
      unit: 's',
      precision: 1,
    },
    {
      key: 'resolution',
      type: 'select',
      label: 'Resolution',
      default: '1080',
      span: 'half',
      choices: [
        { value: 'first', label: 'Match first image' },
        { value: '2160', label: '4K · 3840×2160' },
        { value: '1080', label: '1080p · 1920×1080' },
        { value: '720', label: '720p · 1280×720' },
        { value: 'square', label: 'Square · 1080×1080' },
        { value: 'vertical', label: 'Vertical · 1080×1920' },
      ],
    },
    {
      key: 'fps',
      type: 'select',
      label: 'Frame rate',
      default: '30',
      span: 'half',
      choices: ['24', '25', '30', '60'].map((value) => ({ value, label: `${value} fps` })),
    },
    {
      key: 'fit',
      type: 'segmented',
      label: 'Fit',
      default: 'contain',
      choices: [
        { value: 'contain', label: 'Fit', hint: 'Show the whole image with bars' },
        { value: 'cover', label: 'Fill', hint: 'Fill the frame and crop edges' },
      ],
    },
    { key: 'background', type: 'color', label: 'Bar color', default: '#000000', visibleWhen: (o) => o.fit === 'contain' },
    {
      key: 'format',
      type: 'segmented',
      label: 'Format',
      default: 'mp4',
      choices: [
        { value: 'mp4', label: 'MP4' },
        { value: 'mkv', label: 'MKV' },
      ],
    },
  ],
  outputExtension: (o) => (o.format === 'mkv' ? 'mkv' : 'mp4'),
  expectedDuration: (o, inputs) => inputs.main.length * o.secondsPerImage,
  buildArgs: (o, inputs, ctx) => {
    const first = primaryFile(inputs);
    const [width, height] =
      o.resolution === 'first' && first.width && first.height
        ? [even(first.width), even(first.height)]
        : (RESOLUTIONS[o.resolution] ?? RESOLUTIONS['1080']);
    const container = o.format === 'mkv' ? 'mkv' : 'mp4';

    const args = inputs.main.flatMap((image) => ['-loop', '1', '-framerate', o.fps, '-t', String(o.secondsPerImage), '-i', image.path]);
    const audio = extraFiles(inputs, 'audio')[0];
    if (audio) args.push('-i', audio.path);

    const fitChain =
      o.fit === 'cover'
        ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
        : `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${ffmpegColor(o.background)}`;
    const chains = inputs.main.map((_, i) => `[${i}:v]${fitChain},setsar=1,fps=${o.fps},format=yuv420p[v${i}]`);
    const labels = inputs.main.map((_, i) => `[v${i}]`).join('');
    const graph = `${chains.join(';')};${labels}concat=n=${inputs.main.length}:v=1:a=0[outv]`;

    args.push('-filter_complex', graph, '-map', '[outv]');
    if (audio) args.push('-map', `${inputs.main.length}:a:0`, ...audioEncoderFor(container), '-shortest');
    args.push(...videoEncoderArgs('h264', 20, 'medium', container), '-r', o.fps, ...containerFlags(container));
    return [...args, ctx.output];
  },
});
