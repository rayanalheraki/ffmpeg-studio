/**
 * Parses `HH:MM:SS(.mmm)`, `MM:SS(.mmm)` or plain seconds into seconds.
 * Returns null for empty or malformed input.
 */
export function parseTime(input: string): number | null {
  const value = input.trim();
  if (value === '') return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);

  const match = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (minutes >= 60 || seconds >= 60) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

/** Formats seconds as `HH:MM:SS.mmm`, the form FFmpeg accepts everywhere. */
export function toFfmpegTime(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe - hours * 3600 - minutes * 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${seconds.toFixed(3).padStart(6, '0')}`;
}

/** Formats seconds for display, e.g. `1:05:09` or `3:07`. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '--:--';
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return `${hours > 0 ? `${hours}:` : ''}${mm}:${String(seconds).padStart(2, '0')}`;
}
