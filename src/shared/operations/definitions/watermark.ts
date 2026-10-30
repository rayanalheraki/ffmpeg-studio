import type { MediaFile } from '../../types/media';
import { defineOperation, type Anchor } from '../types';
import { drawtextPosition, escapeFilterPath, escapeFilterValue, even, ffmpegColor, overlayPosition, round } from '../helpers/filters';
import { extraFiles, primaryFile, visualEncodeArgs, visualExtension } from '../helpers/streams';

type Options = {
  type: string;
  text: string;
  color: string;
  position: Anchor;
  size: number;
  opacity: number;
  margin: number;
};

function textFilter(o: Options, file: MediaFile, fontFile: string | null): string {
  const fontSize = Math.max(8, Math.round((file.height ?? 1080) * (o.size / 100)));
  const { x, y } = drawtextPosition(o.position, o.margin);
  const parts = [
    ...(fontFile ? [`fontfile=${escapeFilterPath(fontFile)}`] : []),
    `text=${escapeFilterValue(o.text)}`,
    'expansion=none',
    `fontsize=${fontSize}`,
    `fontcolor=${ffmpegColor(o.color, o.opacity / 100)}`,
    `shadowcolor=${ffmpegColor('#000000', (o.opacity / 100) * 0.4)}`,
    'shadowx=2',
    'shadowy=2',
    `x=${x}`,
    `y=${y}`,
  ];
  return `drawtext=${parts.join(':')}`;
}

function imageGraph(o: Options, file: MediaFile): string {
  const width = even((file.width ?? 1920) * (o.size / 100));
  const { x, y } = overlayPosition(o.position, o.margin);
  return (
    `[1:v]format=rgba,scale=${width}:-1,colorchannelmixer=aa=${round(o.opacity / 100, 2)}[wm];` +
    `[0:v][wm]overlay=${x}:${y}:format=auto,format=yuv420p[outv]`
  );
}

export default defineOperation<Options>({
  id: 'watermark',
  label: 'Watermark',
  description: 'Stamp text or a logo onto videos and images at any of nine positions.',
  category: 'effects',
  icon: 'Stamp',
  order: 2,
  batch: 'perFile',
  input: { accept: ['video', 'image'], label: 'Videos or images' },
  extraSlots: [
    {
      id: 'image',
      label: 'Watermark image',
      description: 'One logo for every file, or one per file (matched by order). PNG with transparency works best.',
      accept: ['image'],
      multiple: true,
      distribution: 'paired',
      requiredWhen: (o) => o.type === 'image',
      visibleWhen: (o) => o.type === 'image',
    },
  ],
  outputSuffix: 'watermarked',
  options: [
    {
      key: 'type',
      type: 'segmented',
      label: 'Watermark type',
      default: 'text',
      choices: [
        { value: 'text', label: 'Text' },
        { value: 'image', label: 'Image' },
      ],
    },
    {
      key: 'text',
      type: 'text',
      label: 'Text',
      default: '© My Studio',
      placeholder: 'Watermark text',
      maxLength: 200,
      visibleWhen: (o) => o.type === 'text',
    },
    { key: 'color', type: 'color', label: 'Text color', default: '#ffffff', visibleWhen: (o) => o.type === 'text' },
    { key: 'position', type: 'anchor', label: 'Position', default: 'bottom-right' },
    {
      key: 'size',
      type: 'slider',
      label: 'Size',
      description: 'Text: height relative to the video. Image: width relative to the video.',
      min: 1,
      max: 50,
      step: 1,
      default: 5,
      unit: '%',
    },
    { key: 'opacity', type: 'slider', label: 'Opacity', min: 5, max: 100, step: 1, default: 80, unit: '%' },
    { key: 'margin', type: 'slider', label: 'Margin', min: 0, max: 200, step: 2, default: 24, unit: 'px' },
  ],
  outputExtension: (_o, file) => visualExtension(file),
  validate: (o, inputs) => {
    if (o.type === 'text' && o.text.trim() === '') return 'Enter the watermark text.';
    if (o.type === 'image' && extraFiles(inputs, 'image').length === 0) return 'Add a watermark image.';
    return null;
  },
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    if (o.type === 'text') {
      return ['-i', file.path, '-vf', textFilter(o, file, ctx.fontFile), ...visualEncodeArgs(file), ctx.output];
    }
    const image = extraFiles(inputs, 'image')[0];
    if (!image) throw new Error('No watermark image was provided.');
    const audioMap = file.hasAudio ? ['-map', '0:a?'] : [];
    return [
      '-i',
      file.path,
      '-i',
      image.path,
      '-filter_complex',
      imageGraph(o, file),
      '-map',
      '[outv]',
      ...audioMap,
      ...visualEncodeArgs(file),
      ctx.output,
    ];
  },
});
