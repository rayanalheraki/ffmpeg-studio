import { t } from '../i18n';

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function formatBitRate(bitsPerSecond: number | null | undefined): string {
  if (bitsPerSecond == null || !Number.isFinite(bitsPerSecond)) return '—';
  if (bitsPerSecond >= 1_000_000) return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mb/s`;
  return `${Math.round(bitsPerSecond / 1000)} kb/s`;
}

export function formatResolution(width: number | null, height: number | null): string | null {
  return width && height ? `${width}×${height}` : null;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return t('{h}h {m}m', { h, m });
  if (m > 0) return t('{m}m {s}s', { m, s: String(s).padStart(2, '0') });
  return t('{s}s', { s });
}
