import { existsSync } from 'node:fs';
import { join } from 'node:path';

function candidates(): string[] {
  switch (process.platform) {
    case 'win32': {
      const fonts = join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts');
      return ['segoeui.ttf', 'arial.ttf', 'calibri.ttf', 'tahoma.ttf'].map((file) => join(fonts, file));
    }
    case 'darwin':
      return [
        '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/Library/Fonts/Arial.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
        '/System/Library/Fonts/SFNS.ttf',
      ];
    default:
      return [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/TTF/DejaVuSans.ttf',
        '/usr/share/fonts/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/usr/share/fonts/noto/NotoSans-Regular.ttf',
        '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
      ];
  }
}

let cached: string | null | undefined;

/**
 * A font file for FFmpeg's `drawtext` filter. The bundled FFmpeg builds do not
 * ship fontconfig defaults on every platform, so an explicit file is safer.
 */
export function findSystemFont(): string | null {
  if (cached === undefined) cached = candidates().find((file) => existsSync(file)) ?? null;
  return cached;
}
