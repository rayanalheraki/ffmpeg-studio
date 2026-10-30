import { t } from '../i18n';

/** Flags added to every FFmpeg job. Overwrite is resolved beforehand, so `-y` is always safe. */
export const GLOBAL_ARGS: readonly string[] = ['-hide_banner', '-nostdin', '-y'];

/** Machine-readable progress on stdout; stderr is kept for the log. */
export const PROGRESS_ARGS: readonly string[] = ['-progress', 'pipe:1', '-nostats'];

/**
 * Combines global flags, operation arguments and user extra arguments.
 * Extra arguments are inserted right before the output path (the last
 * argument of every `buildArgs` result).
 */
export function assembleArgs(operationArgs: readonly string[], extraArgs: readonly string[] = []): string[] {
  if (operationArgs.length === 0) throw new Error('An operation returned no FFmpeg arguments.');
  const output = operationArgs[operationArgs.length - 1] as string;
  return [...GLOBAL_ARGS, ...PROGRESS_ARGS, ...operationArgs.slice(0, -1), ...extraArgs, output];
}

export interface SplitResult {
  args: string[];
  error: string | null;
}

/**
 * Splits user-typed extra arguments like a shell would, honoring single and
 * double quotes. The result is passed to `spawn` as an array, never through a shell.
 */
export function splitArgs(input: string): SplitResult {
  const args: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let hasToken = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i] as string;
    if (quote) {
      if (char === quote) quote = null;
      else if (char === '\\' && quote === '"' && (input[i + 1] === '"' || input[i + 1] === '\\')) {
        current += input[i + 1];
        i += 1;
      } else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      hasToken = true;
    } else if (/\s/.test(char)) {
      if (hasToken) args.push(current);
      current = '';
      hasToken = false;
    } else {
      current += char;
      hasToken = true;
    }
  }

  if (quote === '"') return { args: [], error: t('Missing closing double quote in extra arguments.') };
  if (quote) return { args: [], error: t('Missing closing single quote in extra arguments.') };
  if (hasToken) args.push(current);
  return { args, error: null };
}

/** Quotes one argument for display so the command can be pasted into a terminal. */
export function quoteArg(arg: string, platform: string): string {
  if (arg !== '' && /^[\w@%+=:,./\\-]+$/.test(arg)) return arg;
  if (platform === 'win32') return `"${arg.replace(/"/g, '\\"')}"`;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

export function formatCommand(argv: readonly string[], platform: string): string {
  return argv.map((arg) => quoteArg(arg, platform)).join(' ');
}
