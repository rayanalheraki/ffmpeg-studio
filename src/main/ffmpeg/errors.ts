interface ErrorPattern {
  test: RegExp;
  message: string;
}

/** Known FFmpeg failures mapped to plain-language explanations. Order matters: first match wins. */
const PATTERNS: readonly ErrorPattern[] = [
  { test: /No such file or directory/i, message: 'An input file could not be found. It may have been moved or deleted.' },
  { test: /Permission denied|Access is denied/i, message: 'Permission denied. Choose an output folder you can write to.' },
  { test: /No space left on device/i, message: 'The disk is full. Free up space or choose another output folder.' },
  {
    test: /Invalid data found when processing input|moov atom not found/i,
    message: 'The file is damaged or is not a supported media format.',
  },
  {
    test: /Stream map '.*' matches no streams|does not contain any stream|Output file .* does not contain any stream/i,
    message: 'The file does not contain the stream this operation needs (for example audio or subtitles).',
  },
  { test: /Unknown encoder|Encoder not found/i, message: 'A required encoder is not available in the bundled FFmpeg build.' },
  {
    test: /Could not find tag for codec|not currently supported in container|codec not currently supported/i,
    message: 'The selected output format does not support one of the codecs. Try MKV or another format.',
  },
  {
    test: /Subtitle encoding currently only possible from text to text|bitmap to bitmap/i,
    message: 'Image-based subtitles (such as PGS or VobSub) cannot be converted to text formats.',
  },
  {
    test: /Unable to open .*\.(srt|ass|ssa|vtt)|Unable to parse/i,
    message: 'The subtitle file could not be read. Check that it is valid UTF-8 text.',
  },
  { test: /width not divisible by 2|height not divisible by 2/i, message: 'The output size must use even numbers for width and height.' },
  {
    test: /Error (initializing|reinitializing) filters?|Invalid argument.*filter|Error parsing filterchain/i,
    message: 'FFmpeg could not apply the filters with these settings.',
  },
  { test: /Unrecognized option|Option not found/i, message: 'One of the extra arguments is not recognized by FFmpeg.' },
];

function lastMeaningfulLine(log: string): string | null {
  const lines = log
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('frame=') && !/^\s*(Stream|Metadata|Duration|Input|Output)\b/.test(line));
  return lines.pop() ?? null;
}

/** Turns FFmpeg's stderr into a short message for the user; details stay in the log panel. */
export function summarizeFailure(log: string, exitCode: number | null): string {
  for (const pattern of PATTERNS) if (pattern.test.test(log)) return pattern.message;
  const detail = lastMeaningfulLine(log);
  const base = exitCode == null ? 'FFmpeg stopped unexpectedly.' : `FFmpeg failed (exit code ${exitCode}).`;
  return detail ? `${base} ${detail.slice(0, 240)}` : base;
}
