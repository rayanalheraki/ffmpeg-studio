import { msg, t } from '@shared/i18n';

interface ErrorPattern {
  test: RegExp;
  /** English source text, translated when the failure is summarized. */
  message: string;
}

/** Known FFmpeg failures mapped to plain-language explanations. Order matters: first match wins. */
const PATTERNS: readonly ErrorPattern[] = [
  { test: /No such file or directory/i, message: msg('An input file could not be found. It may have been moved or deleted.') },
  { test: /Permission denied|Access is denied/i, message: msg('Permission denied. Choose an output folder you can write to.') },
  { test: /No space left on device/i, message: msg('The disk is full. Free up space or choose another output folder.') },
  {
    test: /Invalid data found when processing input|moov atom not found/i,
    message: msg('The file is damaged or is not a supported media format.'),
  },
  {
    test: /Stream map '.*' matches no streams|does not contain any stream|Output file .* does not contain any stream/i,
    message: msg('The file does not contain the stream this operation needs (for example audio or subtitles).'),
  },
  { test: /Unknown encoder|Encoder not found/i, message: msg('A required encoder is not available in the bundled FFmpeg build.') },
  {
    test: /Could not find tag for codec|not currently supported in container|codec not currently supported/i,
    message: msg('The selected output format does not support one of the codecs. Try MKV or another format.'),
  },
  {
    test: /Subtitle encoding currently only possible from text to text|bitmap to bitmap/i,
    message: msg('Image-based subtitles (such as PGS or VobSub) cannot be converted to text formats.'),
  },
  {
    test: /Unable to open .*\.(srt|ass|ssa|vtt)|Unable to parse/i,
    message: msg('The subtitle file could not be read. Check that it is valid UTF-8 text.'),
  },
  {
    test: /width not divisible by 2|height not divisible by 2/i,
    message: msg('The output size must use even numbers for width and height.'),
  },
  {
    test: /Error (initializing|reinitializing) filters?|Invalid argument.*filter|Error parsing filterchain/i,
    message: msg('FFmpeg could not apply the filters with these settings.'),
  },
  { test: /Unrecognized option|Option not found/i, message: msg('One of the extra arguments is not recognized by FFmpeg.') },
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
  for (const pattern of PATTERNS) if (pattern.test.test(log)) return t(pattern.message);
  const detail = lastMeaningfulLine(log);
  const base = exitCode == null ? t('FFmpeg stopped unexpectedly.') : t('FFmpeg failed (exit code {code}).', { code: exitCode });
  return detail ? `${base} ${detail.slice(0, 240)}` : base;
}
