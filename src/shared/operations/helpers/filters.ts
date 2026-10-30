import type { Anchor } from '../types';

/**
 * Escapes a value used as a filter option inside a filtergraph string.
 *
 * FFmpeg parses filtergraphs twice: once for the graph (`[ ] , ; ' \`) and once
 * for each option value (`: ' \`). Arguments are passed to `spawn` directly,
 * so there is no shell level to account for.
 */
export function escapeFilterValue(value: string): string {
  const optionLevel = value.replace(/[\\':]/g, (char) => `\\${char}`);
  return optionLevel.replace(/[\\'[\],;]/g, (char) => `\\${char}`);
}

/** Escapes a file path for filters such as `subtitles` or `drawtext`. */
export function escapeFilterPath(filePath: string): string {
  return escapeFilterValue(filePath.replace(/\\/g, '/'));
}

/** Converts `#rrggbb` to the `0xRRGGBB` form accepted by every FFmpeg color option. */
export function ffmpegColor(hex: string, alpha?: number): string {
  const clean = /^#?([0-9a-fA-F]{6})$/.exec(hex)?.[1] ?? 'ffffff';
  const base = `0x${clean.toUpperCase()}`;
  return alpha === undefined ? base : `${base}@${round(alpha, 2)}`;
}

export function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Rounds to the nearest even integer (most encoders require even dimensions). */
export function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

interface PositionVars {
  containerW: string;
  containerH: string;
  itemW: string;
  itemH: string;
}

const OVERLAY_VARS: PositionVars = { containerW: 'main_w', containerH: 'main_h', itemW: 'overlay_w', itemH: 'overlay_h' };
const DRAWTEXT_VARS: PositionVars = { containerW: 'w', containerH: 'h', itemW: 'text_w', itemH: 'text_h' };

function anchorPosition(anchor: Anchor, margin: number, vars: PositionVars): { x: string; y: string } {
  const m = Math.max(0, Math.round(margin));
  const horizontal = anchor.includes('left') ? 'start' : anchor.includes('right') ? 'end' : 'middle';
  const vertical = anchor.startsWith('top') ? 'start' : anchor.startsWith('bottom') ? 'end' : 'middle';
  const axis = (pos: string, container: string, item: string): string =>
    pos === 'start' ? `${m}` : pos === 'end' ? `${container}-${item}-${m}` : `(${container}-${item})/2`;
  return {
    x: axis(horizontal, vars.containerW, vars.itemW),
    y: axis(vertical, vars.containerH, vars.itemH),
  };
}

export function overlayPosition(anchor: Anchor, margin: number): { x: string; y: string } {
  return anchorPosition(anchor, margin, OVERLAY_VARS);
}

export function drawtextPosition(anchor: Anchor, margin: number): { x: string; y: string } {
  return anchorPosition(anchor, margin, DRAWTEXT_VARS);
}

/**
 * Builds an `atempo` chain for any speed factor. Each stage is kept inside
 * 0.5–2.0, which every FFmpeg version supports and preserves pitch.
 */
export function atempoChain(speed: number): string {
  const stages: number[] = [];
  let remaining = speed;
  while (remaining > 2) {
    stages.push(2);
    remaining /= 2;
  }
  while (remaining < 0.5) {
    stages.push(0.5);
    remaining /= 0.5;
  }
  stages.push(remaining);
  return stages.map((stage) => `atempo=${round(stage, 4)}`).join(',');
}
