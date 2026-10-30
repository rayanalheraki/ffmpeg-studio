import type { JobInputs } from '../types';
import { parseTime, toFfmpegTime } from '../../utils/time';
import { defineOperation } from '../types';
import { audioEncoderFor, containerFlags, videoEncoderArgs } from '../helpers/encoders';
import { h264Container, primaryFile } from '../helpers/streams';

type Options = {
  start: string;
  end: string;
  mode: string;
};

function range(o: Options, inputs: JobInputs): { start: number; length: number | null } {
  const start = parseTime(o.start) ?? 0;
  const end = parseTime(o.end);
  const total = primaryFile(inputs).duration;
  const stop = end ?? total;
  return { start, length: stop == null ? null : Math.max(0, stop - start) };
}

export default defineOperation<Options>({
  id: 'trim',
  label: 'Trim',
  description: 'Cut a section from videos or audio by start and end time.',
  category: 'edit',
  icon: 'Scissors',
  order: 1,
  batch: 'perFile',
  input: { accept: ['video', 'audio'] },
  outputSuffix: 'trimmed',
  options: [
    { key: 'start', type: 'time', label: 'Start', default: '00:00:00', placeholder: '00:00:00', span: 'half' },
    { key: 'end', type: 'time', label: 'End', default: '', placeholder: 'End of file', span: 'half' },
    {
      key: 'mode',
      type: 'segmented',
      label: 'Cutting mode',
      default: 'fast',
      choices: [
        { value: 'fast', label: 'Fast', hint: 'No re-encoding. Cuts snap to the nearest keyframe.' },
        { value: 'accurate', label: 'Frame accurate', hint: 'Re-encodes for exact cut points.' },
      ],
    },
  ],
  outputExtension: (o, file) => (o.mode === 'accurate' && file.hasVideo ? h264Container(file) : file.ext),
  expectedDuration: (o, inputs) => range(o, inputs).length,
  validate: (o, inputs) => {
    const start = parseTime(o.start);
    const end = parseTime(o.end);
    if (o.start.trim() !== '' && start == null) return 'Start time is not a valid timestamp.';
    if (o.end.trim() !== '' && end == null) return 'End time is not a valid timestamp.';
    if (start != null && end != null && end <= start) return 'End time must be after the start time.';
    const total = primaryFile(inputs).duration;
    if (start != null && total != null && start >= total) return 'Start time is beyond the end of the file.';
    return null;
  },
  buildArgs: (o, inputs, ctx) => {
    const file = primaryFile(inputs);
    const { start, length } = range(o, inputs);
    const args: string[] = [];
    if (start > 0) args.push('-ss', toFfmpegTime(start));
    args.push('-i', file.path);
    if (length != null && parseTime(o.end) != null) args.push('-t', toFfmpegTime(length));

    if (o.mode === 'fast') {
      args.push('-map', '0', '-c', 'copy', '-avoid_negative_ts', 'make_zero');
    } else if (file.hasVideo) {
      const container = h264Container(file);
      args.push(...videoEncoderArgs('h264', 18, 'fast', container));
      if (file.hasAudio) args.push(...audioEncoderFor(container));
      args.push(...containerFlags(container));
    } else {
      args.push(...audioEncoderFor(file.ext));
    }
    return [...args, ctx.output];
  },
});
