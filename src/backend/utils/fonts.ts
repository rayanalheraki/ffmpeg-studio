import { joinPath } from '@shared/utils/path';
import { type HostInfo, host } from '../host';

/** Font files to try for each platform, most preferred first. */
export function fontCandidates(platform: HostInfo['platform'], windowsDir: string | null): string[] {
  switch (platform) {
    case 'win32': {
      const fonts = joinPath(windowsDir ?? 'C:\\Windows', 'Fonts');
      return ['segoeui.ttf', 'arial.ttf', 'calibri.ttf', 'tahoma.ttf'].map((file) => joinPath(fonts, file));
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

let cached: Promise<string | null> | undefined;

async function find(): Promise<string | null> {
  const { platform, windowsDir } = await host.info();
  for (const file of fontCandidates(platform, windowsDir)) {
    if ((await host.pathInfo(file))?.isFile) return file;
  }
  return null;
}

/**
 * A font file for FFmpeg's `drawtext` filter. The bundled FFmpeg builds do not
 * ship fontconfig defaults on every platform, so an explicit file is safer.
 */
export function findSystemFont(): Promise<string | null> {
  cached ??= find().catch(() => null);
  return cached;
}
