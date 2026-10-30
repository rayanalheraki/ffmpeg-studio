import { defineOperation } from '../types';
import { extraFiles, primaryFile } from '../helpers/streams';

type Options = {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  comment: string;
  clearExisting: boolean;
};

const TAG_KEYS = ['title', 'artist', 'album', 'year', 'genre', 'comment'] as const;
const COVER_FORMATS = ['mp3', 'm4a', 'flac'];

/** FFmpeg's generic tag names; `year` is stored as `date`. */
const FFMPEG_TAG: Record<(typeof TAG_KEYS)[number], string> = {
  title: 'title',
  artist: 'artist',
  album: 'album',
  year: 'date',
  genre: 'genre',
  comment: 'comment',
};

export default defineOperation<Options>({
  id: 'edit-metadata',
  label: 'Metadata & cover art',
  description: 'Edit title, artist, album and more, and embed cover art in audio files.',
  category: 'audio',
  icon: 'Tags',
  order: 5,
  batch: 'perFile',
  input: { accept: ['audio', 'video'] },
  extraSlots: [
    {
      id: 'cover',
      label: 'Cover art',
      description: 'Optional. Supported for MP3, M4A and FLAC files.',
      accept: ['image'],
      multiple: true,
      distribution: 'paired',
      requiredWhen: () => false,
    },
  ],
  outputSuffix: 'tagged',
  options: [
    { key: 'title', type: 'text', label: 'Title', default: '', placeholder: 'Keep existing', span: 'half', maxLength: 200 },
    { key: 'artist', type: 'text', label: 'Artist', default: '', placeholder: 'Keep existing', span: 'half', maxLength: 200 },
    { key: 'album', type: 'text', label: 'Album', default: '', placeholder: 'Keep existing', span: 'half', maxLength: 200 },
    { key: 'year', type: 'text', label: 'Year', default: '', placeholder: 'e.g. 2024', span: 'half', maxLength: 10 },
    { key: 'genre', type: 'text', label: 'Genre', default: '', placeholder: 'Keep existing', span: 'half', maxLength: 100 },
    { key: 'comment', type: 'text', label: 'Comment', default: '', placeholder: 'Keep existing', span: 'half', maxLength: 500 },
    { key: 'clearExisting', type: 'toggle', label: 'Remove all existing metadata first', default: false },
  ],
  outputExtension: (_o, file) => file.ext,
  validate: (o, inputs) => {
    const file = primaryFile(inputs);
    const cover = extraFiles(inputs, 'cover')[0];
    if (cover && !COVER_FORMATS.includes(file.ext)) return `Cover art is not supported for .${file.ext} files. Use MP3, M4A or FLAC.`;
    if (o.year.trim() !== '' && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(o.year.trim())) return 'Year must look like 2024 or 2024-05-01.';
    const hasTag = TAG_KEYS.some((key) => o[key].trim() !== '');
    return hasTag || cover || o.clearExisting ? null : 'Enter at least one field, add cover art, or clear existing metadata.';
  },
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    const cover = extraFiles(inputs, 'cover')[0];
    const args = ['-i', file.path];
    if (cover) args.push('-i', cover.path, '-map', '0:a', '-map', '1:0');
    else args.push('-map', '0');
    args.push('-c', 'copy');
    if (o.clearExisting) args.push('-map_metadata', '-1');

    for (const key of TAG_KEYS) {
      const value = o[key].trim();
      if (value !== '') args.push('-metadata', `${FFMPEG_TAG[key]}=${value}`);
    }
    if (cover) {
      args.push('-disposition:v:0', 'attached_pic', '-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)');
    }
    if (file.ext === 'mp3') args.push('-id3v2_version', '3');
    return [...args, ctx.output];
  },
});
