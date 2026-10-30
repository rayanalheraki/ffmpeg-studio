import type { MediaFile } from '../../types/media';
import { defineOperation } from '../types';
import { containerFlags, videoEncoderArgs } from '../helpers/encoders';
import { escapeFilterPath, escapeFilterValue } from '../helpers/filters';
import { audioCopyOrEncode, extraFiles, h264Container, primaryFile } from '../helpers/streams';
import { t } from '../../i18n';

type Options = {
  mode: string;
  language: string;
  makeDefault: boolean;
  fontSize: number;
};

const SOFT_CONTAINERS = ['mp4', 'mov', 'mkv', 'webm'];

/** Subtitle codec that each container can hold. */
const SUBTITLE_CODECS: Record<string, string> = { mp4: 'mov_text', mov: 'mov_text', webm: 'webvtt', mkv: 'copy' };

function softContainer(file: MediaFile): string {
  return SOFT_CONTAINERS.includes(file.ext) ? file.ext : 'mkv';
}

function softArgs(o: Options, video: MediaFile, subtitles: MediaFile[], output: string): string[] {
  const container = softContainer(video);
  const args = ['-i', video.path, ...subtitles.flatMap((sub) => ['-i', sub.path])];
  args.push('-map', '0:v', '-map', '0:a?', '-map', '0:s?');
  subtitles.forEach((_, i) => args.push('-map', `${i + 1}:0`));
  args.push('-c', 'copy');

  const language = o.language.trim().toLowerCase();
  subtitles.forEach((_, i) => {
    const index = video.subtitleStreams + i;
    args.push(`-c:s:${index}`, SUBTITLE_CODECS[container] ?? 'copy');
    if (/^[a-z]{2,3}$/.test(language)) args.push(`-metadata:s:s:${index}`, `language=${language}`);
  });
  if (o.makeDefault) args.push(`-disposition:s:${video.subtitleStreams}`, 'default');
  return [...args, ...containerFlags(container), output];
}

function burnArgs(o: Options, video: MediaFile, subtitle: MediaFile, output: string): string[] {
  const container = h264Container(video);
  const style = escapeFilterValue(`FontSize=${Math.round(o.fontSize)}`);
  return [
    '-i',
    video.path,
    '-vf',
    `subtitles=filename=${escapeFilterPath(subtitle.path)}:force_style=${style}`,
    ...videoEncoderArgs('h264', 20, 'medium', container),
    ...audioCopyOrEncode(video, container),
    ...containerFlags(container),
    output,
  ];
}

export default defineOperation<Options>({
  id: 'add-subtitles',
  label: 'Add subtitles',
  description: 'Add subtitle tracks that viewers can toggle, or burn them permanently into the picture.',
  category: 'effects',
  icon: 'Captions',
  order: 3,
  batch: 'perFile',
  input: { accept: ['video'], label: 'Videos' },
  extraSlots: [
    {
      id: 'subtitles',
      label: 'Subtitle files',
      description: 'SRT, ASS or VTT. Every file is added as a track to every video. Burn-in uses the first file.',
      accept: ['subtitle'],
      multiple: true,
      distribution: 'all',
    },
  ],
  outputSuffix: (o) => (o.mode === 'burn' ? 'hardsub' : 'subtitled'),
  options: [
    {
      key: 'mode',
      type: 'segmented',
      label: 'Mode',
      default: 'soft',
      choices: [
        { value: 'soft', label: 'Soft subtitles', hint: 'Selectable tracks, no re-encoding' },
        { value: 'burn', label: 'Burn in', hint: 'Always visible, re-encodes video' },
      ],
    },
    {
      key: 'language',
      type: 'text',
      label: 'Language code',
      description: 'ISO 639 code such as eng, spa or fra. Leave empty to skip.',
      default: 'eng',
      placeholder: 'eng',
      maxLength: 3,
      span: 'half',
      visibleWhen: (o) => o.mode === 'soft',
    },
    { key: 'makeDefault', type: 'toggle', label: 'Show by default', default: true, visibleWhen: (o) => o.mode === 'soft' },
    {
      key: 'fontSize',
      type: 'slider',
      label: 'Font size',
      min: 10,
      max: 72,
      step: 1,
      default: 24,
      unit: 'pt',
      visibleWhen: (o) => o.mode === 'burn',
    },
  ],
  outputExtension: (o, file) => (o.mode === 'burn' ? h264Container(file) : softContainer(file)),
  validate: (o, inputs) => {
    if (extraFiles(inputs, 'subtitles').length === 0) return t('Add at least one subtitle file.');
    if (o.mode === 'soft' && o.language.trim() !== '' && !/^[a-zA-Z]{2,3}$/.test(o.language.trim())) {
      return t('Language must be a 2 or 3 letter code, like eng.');
    }
    return null;
  },
  buildArgs: (o, inputs, ctx) => {
    const video = primaryFile(inputs);
    const subtitles = extraFiles(inputs, 'subtitles');
    const first = subtitles[0];
    if (!first) throw new Error('No subtitle file was provided.');
    return o.mode === 'burn' ? burnArgs(o, video, first, ctx.output) : softArgs(o, video, subtitles, ctx.output);
  },
});
