import { defineOperation } from '../types';
import { primaryFile } from '../helpers/streams';
import { t, tp } from '../../i18n';

type Options = {
  track: number;
  format: string;
};

const CODECS: Record<string, string> = { srt: 'srt', ass: 'ass', vtt: 'webvtt' };

export default defineOperation<Options>({
  id: 'extract-subtitles',
  label: 'Extract subtitles',
  description: 'Save an embedded subtitle track as an SRT, ASS or VTT file.',
  category: 'tools',
  icon: 'FileText',
  order: 3,
  batch: 'perFile',
  input: { accept: ['video'] },
  outputSuffix: (o) => `subs${o.track + 1}`,
  options: [
    {
      key: 'track',
      type: 'number',
      label: 'Subtitle track',
      description: 'Track number, starting at 0 for the first subtitle track.',
      min: 0,
      max: 99,
      step: 1,
      default: 0,
      span: 'half',
    },
    {
      key: 'format',
      type: 'segmented',
      label: 'Format',
      default: 'srt',
      choices: [
        { value: 'srt', label: 'SRT', hint: 'Most compatible' },
        { value: 'ass', label: 'ASS', hint: 'Keeps styling' },
        { value: 'vtt', label: 'VTT', hint: 'For the web' },
      ],
    },
  ],
  outputExtension: (o) => (CODECS[o.format] ? o.format : 'srt'),
  validate: (o, inputs) => {
    const file = primaryFile(inputs);
    if (file.subtitleStreams === 0) return t('This file has no subtitle tracks.');
    if (o.track >= file.subtitleStreams)
      return tp(file.subtitleStreams, 'This file only has {count} subtitle track.', 'This file only has {count} subtitle tracks.');
    return null;
  },
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    return ['-i', file.path, '-map', `0:s:${Math.round(o.track)}`, '-c:s', CODECS[o.format] ?? 'srt', ctx.output];
  },
});
