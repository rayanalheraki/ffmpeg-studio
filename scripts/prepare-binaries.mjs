/**
 * Copies the FFmpeg and FFprobe binaries from ffmpeg-static / ffprobe-static
 * into src-tauri/binaries with the target-triple suffix Tauri expects for
 * `externalBin` (e.g. ffmpeg-x86_64-pc-windows-msvc.exe).
 *
 * Usage: node scripts/prepare-binaries.mjs
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'src-tauri', 'binaries');
const ext = process.platform === 'win32' ? '.exe' : '';

function targetTriple() {
  if (process.env.TAURI_ENV_TARGET_TRIPLE) return process.env.TAURI_ENV_TARGET_TRIPLE;
  try {
    const output = execFileSync('rustc', ['-vV'], { encoding: 'utf8' });
    const host = /host: (\S+)/.exec(output)?.[1];
    if (host) return host;
  } catch {
    // Fall through to the error below.
  }
  throw new Error('Could not determine the Rust target triple. Install Rust (https://rustup.rs) and try again.');
}

const sources = {
  ffmpeg: require('ffmpeg-static'),
  ffprobe: require('ffprobe-static').path,
};

const triple = targetTriple();
mkdirSync(target, { recursive: true });
for (const [name, source] of Object.entries(sources)) {
  if (!source || !existsSync(source)) {
    throw new Error(`The ${name} binary is missing. Run "npm rebuild ffmpeg-static" and try again.`);
  }
  const destination = join(target, `${name}-${triple}${ext}`);
  if (existsSync(destination) && statSync(destination).size === statSync(source).size) continue;
  copyFileSync(source, destination);
  console.log(`Copied ${name} -> ${destination}`);
}
