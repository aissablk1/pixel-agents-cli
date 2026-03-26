/**
 * Sixel renderer: outputs bitmap graphics using the Sixel escape sequence format.
 * Each Sixel "row" represents 6 vertical pixels.
 *
 * Uses a fixed 216-color palette (6x6x6 RGB cube, same as xterm-256).
 * Includes RLE compression for runs of same-color sixel characters.
 * Skips unchanged frames via a simple hash comparison.
 */

import type { IRenderer, PixelBuffer, FrameOutput } from './types.js';

/** The 6 levels used in the 6x6x6 color cube */
const CUBE_LEVELS = [0, 51, 102, 153, 204, 255];

/** Map an 8-bit channel value to the nearest cube index (0-5) */
function toCubeIndex(value: number): number {
  // Find the closest of the 6 levels
  if (value <= 25) return 0;
  if (value <= 76) return 1;
  if (value <= 127) return 2;
  if (value <= 178) return 3;
  if (value <= 229) return 4;
  return 5;
}

/** Get the palette index (0-215) for an RGB color */
function paletteIndex(r: number, g: number, b: number): number {
  return toCubeIndex(r) * 36 + toCubeIndex(g) * 6 + toCubeIndex(b);
}

/** Build the Sixel palette definition string for the 216-color cube */
function buildPaletteString(): string {
  let result = '';
  for (let ri = 0; ri < 6; ri++) {
    for (let gi = 0; gi < 6; gi++) {
      for (let bi = 0; bi < 6; bi++) {
        const idx = ri * 36 + gi * 6 + bi;
        // Sixel palette uses percentages 0-100
        const rPct = Math.round((CUBE_LEVELS[ri] / 255) * 100);
        const gPct = Math.round((CUBE_LEVELS[gi] / 255) * 100);
        const bPct = Math.round((CUBE_LEVELS[bi] / 255) * 100);
        result += `#${idx};2;${rPct};${gPct};${bPct}`;
      }
    }
  }
  return result;
}

/** Compute a fast hash of the pixel data for frame comparison */
function hashPixelData(data: Uint8Array): number {
  let hash = 0;
  // Sample every 64th byte for speed
  const step = Math.max(1, Math.floor(data.length / 4096));
  for (let i = 0; i < data.length; i += step) {
    hash = ((hash << 5) - hash + data[i]) | 0;
  }
  return hash;
}

export class SixelRenderer implements IRenderer {
  readonly name = 'sixel';
  private paletteStr = '';
  private prevFrameHash = 0;
  private prevPayload = '';

  async init(_termCols: number, _termRows: number): Promise<void> {
    this.paletteStr = buildPaletteString();
    this.prevFrameHash = 0;
    this.prevPayload = '';
  }

  pixelsPerCell(): { x: number; y: number } {
    return { x: 1, y: 6 };
  }

  maxPixelSize(termCols: number, termRows: number): { width: number; height: number } {
    return {
      width: termCols,
      height: termRows * 6,
    };
  }

  renderFrame(pixels: PixelBuffer, offsetRow: number, offsetCol: number): FrameOutput {
    const { width, height, data } = pixels;

    // Skip if frame is identical to previous
    const frameHash = hashPixelData(data);
    if (frameHash === this.prevFrameHash && this.prevPayload.length > 0) {
      return {
        payload: this.prevPayload,
        cursorRow: offsetRow + Math.ceil(height / 6),
        cursorCol: 0,
      };
    }
    this.prevFrameHash = frameHash;

    // Quantize every pixel to its palette index
    const paletteMap = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      paletteMap[i] = paletteIndex(data[idx], data[idx + 1], data[idx + 2]);
    }

    // Build Sixel data
    let sixelData = '';
    const sixelBandHeight = 6;
    const numBands = Math.ceil(height / sixelBandHeight);

    for (let band = 0; band < numBands; band++) {
      const bandY = band * sixelBandHeight;

      // For each band, iterate over used colors and emit sixel characters
      // Collect which colors are used in this band
      const usedColors = new Set<number>();
      for (let dy = 0; dy < sixelBandHeight; dy++) {
        const py = bandY + dy;
        if (py >= height) break;
        for (let x = 0; x < width; x++) {
          usedColors.add(paletteMap[py * width + x]);
        }
      }

      let firstColor = true;
      for (const color of usedColors) {
        // Select color
        sixelData += `#${color}`;

        // Build sixel characters for this color across the band width
        let runChar = '';
        let runLength = 0;

        for (let x = 0; x < width; x++) {
          // Build the 6-bit pattern for this column
          let bits = 0;
          for (let dy = 0; dy < sixelBandHeight; dy++) {
            const py = bandY + dy;
            if (py >= height) break;
            if (paletteMap[py * width + x] === color) {
              bits |= 1 << dy;
            }
          }

          // Sixel character = '?' (0x3F) + bits
          const ch = String.fromCharCode(0x3f + bits);

          // RLE compression
          if (ch === runChar) {
            runLength++;
          } else {
            if (runLength > 0) {
              sixelData += encodeRun(runChar, runLength);
            }
            runChar = ch;
            runLength = 1;
          }
        }

        // Flush remaining run
        if (runLength > 0) {
          sixelData += encodeRun(runChar, runLength);
        }

        // Color layers within same band use '$' (carriage return)
        // except after the last color, where we use '-' (new line = next band)
        if (!firstColor || usedColors.size > 1) {
          // After each color layer except the last one, use '$'
          // We'll handle the band terminator after the loop
        }
        firstColor = false;

        // '$' to return to beginning of the same sixel row for next color
        sixelData += '$';
      }

      // Remove the trailing '$' from the last color and replace with '-' (next band)
      if (sixelData.endsWith('$')) {
        sixelData = sixelData.slice(0, -1);
      }
      if (band < numBands - 1) {
        sixelData += '-';
      }
    }

    // Compose the full Sixel escape sequence
    // Move cursor to position first
    const cursorMove = `\x1b[${offsetRow + 1};${offsetCol + 1}H`;
    // DCS (Device Control String) for Sixel: P0;0;0q
    // 0;0;0 = Pad character aspect ratio; no background; pixel aspect ratio
    const sixelStart = '\x1bP0;0;0q';
    // Set raster attributes: "width;height
    const rasterAttr = `"1;1;${width};${height}`;
    const sixelEnd = '\x1b\\';

    const payload = cursorMove + sixelStart + rasterAttr + this.paletteStr + sixelData + sixelEnd;
    this.prevPayload = payload;

    return {
      payload,
      cursorRow: offsetRow + Math.ceil(height / 6),
      cursorCol: 0,
    };
  }

  dispose(): void {
    this.prevFrameHash = 0;
    this.prevPayload = '';
  }
}

/** Encode a run of identical sixel characters with RLE */
function encodeRun(ch: string, count: number): string {
  if (count <= 3) {
    return ch.repeat(count);
  }
  // Sixel RLE: !<count><char>
  return `!${count}${ch}`;
}
