type Level = 'info' | 'warn' | 'error';

function write(level: Level, scope: string, message: string, detail?: unknown): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${scope}] ${message}`;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (detail === undefined) sink(line);
  else sink(line, detail);
}

/** Small scoped logger for the main process. */
export function createLogger(scope: string): Record<Level, (message: string, detail?: unknown) => void> {
  return {
    info: (message, detail) => write('info', scope, message, detail),
    warn: (message, detail) => write('warn', scope, message, detail),
    error: (message, detail) => write('error', scope, message, detail),
  };
}

/** An error whose message is safe and helpful to show to the user as-is. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}
