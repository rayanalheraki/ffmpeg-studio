import { existsSync } from 'node:fs';
import ffmpegStaticPath from 'ffmpeg-static';
import { path as ffprobeStaticPath } from 'ffprobe-static';
import { t } from '@shared/i18n';
import { UserError } from '../log';

/**
 * Binaries cannot be executed from inside the asar archive, so packaged
 * builds unpack them (see `asarUnpack` in electron-builder.yml).
 */
function unpacked(binaryPath: string): string {
  return binaryPath.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
}

function resolveBinary(name: string, rawPath: string | null): string {
  if (!rawPath) throw new UserError(t('The bundled {name} binary is not available for this platform.', { name }));
  const resolved = unpacked(rawPath);
  if (!existsSync(resolved)) {
    throw new UserError(t('The bundled {name} binary is missing. Reinstall the app or run "npm install" again.', { name }));
  }
  return resolved;
}

let cached: { ffmpeg: string; ffprobe: string } | null = null;

export function getBinaries(): { ffmpeg: string; ffprobe: string } {
  cached ??= {
    ffmpeg: resolveBinary('FFmpeg', ffmpegStaticPath),
    ffprobe: resolveBinary('FFprobe', ffprobeStaticPath),
  };
  return cached;
}
