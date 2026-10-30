/**
 * Renders the application icon (1024×1024 PNG) without any image library:
 * a violet gradient rounded square with a white audio waveform.
 *
 * Usage: node scripts/generate-icon.mjs
 * Writes build/icon.png, the source for the app icons: run `npx tauri icon build/icon.png -o src-tauri/icons` afterwards.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZE = 1024;
const SAMPLES = 4; // 4×4 supersampling for smooth edges
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const BODY = { x: 100, y: 100, w: 824, h: 824, r: 190 };
const TOP = [0x9a, 0x8a, 0xff];
const BOTTOM = [0x4a, 0x38, 0xd0];
const BARS = [150, 290, 430, 540, 430, 290, 150];
const BAR_WIDTH = 58;
const BAR_GAP = 34;

function insideRoundedRect(x, y, { x: rx, y: ry, w, h, r }) {
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= rx && x <= rx + w && y >= ry && y <= ry + h;
}

function insideBars(x, y) {
  const total = BARS.length * BAR_WIDTH + (BARS.length - 1) * BAR_GAP;
  let left = SIZE / 2 - total / 2;
  for (const height of BARS) {
    const top = SIZE / 2 - height / 2;
    if (insideRoundedRect(x, y, { x: left, y: top, w: BAR_WIDTH, h: height, r: BAR_WIDTH / 2 })) return true;
    left += BAR_WIDTH + BAR_GAP;
  }
  return false;
}

function pixel(px, py) {
  let body = 0;
  let mark = 0;
  for (let sy = 0; sy < SAMPLES; sy += 1) {
    for (let sx = 0; sx < SAMPLES; sx += 1) {
      const x = px + (sx + 0.5) / SAMPLES;
      const y = py + (sy + 0.5) / SAMPLES;
      if (insideRoundedRect(x, y, BODY)) {
        body += 1;
        if (insideBars(x, y)) mark += 1;
      }
    }
  }
  const total = SAMPLES * SAMPLES;
  if (body === 0) return [0, 0, 0, 0];

  const t = (px + py - BODY.x - BODY.y) / (BODY.w + BODY.h);
  const highlight = Math.max(0, 1 - (py - BODY.y) / 260) * 0.12;
  const base = TOP.map((top, i) => top + (BOTTOM[i] - top) * t);
  const tinted = base.map((c) => c + (255 - c) * highlight);
  const markShare = mark / body;
  const color = tinted.map((c) => Math.round(c + (255 - c) * markShare));
  return [...color, Math.round((body / total) * 255)];
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng() {
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y += 1) {
    const row = y * (SIZE * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < SIZE; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      raw.set([r, g, b, a], row + 1 + x * 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const png = encodePng();
for (const target of ['build/icon.png']) {
  const file = join(root, target);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png);
  console.log(`Wrote ${target} (${(png.length / 1024).toFixed(0)} KB)`);
}
