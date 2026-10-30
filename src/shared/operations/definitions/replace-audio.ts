import { defineOperation } from '../types';
import { audioEncoderFor, containerFlags } from '../helpers/encoders';
import { extraFiles, primaryFile } from '../helpers/streams';

type Options = {
  mode: string;
  shortest: boolean;
};

export default defineOperation<Options>({
  id: 'replace-audio',
  label: 'Replace or remove audio',
  description: 'Swap the soundtrack of videos, or strip audio entirely. Video is not re-encoded.',
  category: 'audio',
  icon: 'Replace',
  order: 2,
  batch: 'perFile',
  input: { accept: ['video'], label: 'Videos' },
  extraSlots: [
    {
      id: 'audio',
      label: 'New audio',
      description: 'Add one file for every video, or one file per video (matched by order).',
      accept: ['audio'],
      multiple: true,
      distribution: 'paired',
      requiredWhen: (o) => o.mode === 'replace',
      visibleWhen: (o) => o.mode === 'replace',
    },
  ],
  outputSuffix: (o) => (o.mode === 'remove' ? 'muted' : 'new_audio'),
  options: [
    {
      key: 'mode',
      type: 'segmented',
      label: 'Action',
      default: 'replace',
      choices: [
        { value: 'replace', label: 'Replace audio' },
        { value: 'remove', label: 'Remove audio' },
      ],
    },
    {
      key: 'shortest',
      type: 'toggle',
      label: 'End with the shorter stream',
      description: 'Stop the output when either the video or the new audio ends.',
      default: true,
      visibleWhen: (o) => o.mode === 'replace',
    },
  ],
  outputExtension: (_o, file) => file.ext,
  validate: (o, inputs) => {
    if (o.mode === 'replace' && extraFiles(inputs, 'audio').length === 0) return 'Add an audio file to use as the new soundtrack.';
    return null;
  },
  buildArgs: (o, inputs, ctx) => {
    const video = primaryFile(inputs);
    if (o.mode === 'remove') return ['-i', video.path, '-map', '0', '-map', '-0:a', '-c', 'copy', ctx.output];

    const audio = extraFiles(inputs, 'audio')[0];
    if (!audio) throw new Error('No replacement audio file was provided.');
    return [
      '-i',
      video.path,
      '-i',
      audio.path,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      ...audioEncoderFor(video.ext),
      ...(o.shortest ? ['-shortest'] : []),
      ...containerFlags(video.ext),
      ctx.output,
    ];
  },
});
