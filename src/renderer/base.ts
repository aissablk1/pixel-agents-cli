/**
 * Base renderer: rasterizes SpriteData arrays into a PixelBuffer.
 * This is the shared "software renderer" that all backends use.
 */

import { createPixelBuffer, blendPixel } from './types.js';
import type { PixelBuffer } from './types.js';

/** 2D array of hex color strings: '' = transparent, '#RRGGBB' = opaque */
type SpriteData = string[][];

export interface Drawable {
  sprite: SpriteData;
  x: number;
  y: number;
  zY: number;
  mirrored?: boolean;
}

/** Parse a hex color string to RGBA values */
function parseHex(hex: string): { r: number; g: number; b: number; a: number } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) : 255;
  return { r, g, b, a };
}

/** Composite a sprite onto a PixelBuffer at the given position */
export function compositeSprite(
  buf: PixelBuffer,
  sprite: SpriteData,
  destX: number,
  destY: number,
  mirrored = false,
): void {
  for (let row = 0; row < sprite.length; row++) {
    const spriteRow = sprite[row];
    const cols = spriteRow.length;
    for (let col = 0; col < cols; col++) {
      const hex = spriteRow[col];
      if (!hex) continue;
      const srcCol = mirrored ? cols - 1 - col : col;
      const px = destX + srcCol;
      const py = destY + row;
      const { r, g, b, a } = parseHex(hex);
      blendPixel(buf, px, py, r, g, b, a);
    }
  }
}

/** Rasterize a list of drawables (z-sorted) into a PixelBuffer */
export function rasterize(
  width: number,
  height: number,
  drawables: Drawable[],
  bgColor = { r: 30, g: 30, b: 40 },
): PixelBuffer {
  const buf = createPixelBuffer(width, height);

  // Fill background
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    buf.data[idx] = bgColor.r;
    buf.data[idx + 1] = bgColor.g;
    buf.data[idx + 2] = bgColor.b;
    buf.data[idx + 3] = 255;
  }

  // Sort by zY (lower = behind = drawn first)
  const sorted = [...drawables].sort((a, b) => a.zY - b.zY);

  for (const d of sorted) {
    compositeSprite(buf, d.sprite, d.x, d.y, d.mirrored);
  }

  return buf;
}
