/**
 * ASCII/Braille renderer: uses Unicode Braille characters (U+2800-U+28FF).
 * Each terminal cell represents a 2x4 pixel block using braille dot patterns.
 * Simple luminance thresholding determines which dots are "on".
 * Foreground color is the average of "on" pixels; background is black.
 *
 * Braille dot-to-bit mapping:
 *   (0,0)=0x01  (1,0)=0x08
 *   (0,1)=0x02  (1,1)=0x10
 *   (0,2)=0x04  (1,2)=0x20
 *   (0,3)=0x40  (1,3)=0x80
 */

import type { IRenderer, PixelBuffer, FrameOutput } from './types.js';

const RESET = '\x1b[0m';
const LUMINANCE_THRESHOLD = 80;

/** Bit positions for each (dx, dy) offset within a 2x4 braille cell */
const BRAILLE_MAP: number[][] = [
  /* dx=0 */ [0x01, 0x02, 0x04, 0x40],
  /* dx=1 */ [0x08, 0x10, 0x20, 0x80],
];

/** Compute perceived luminance from RGB (ITU-R BT.601) */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export class AsciiRenderer implements IRenderer {
  readonly name = 'ascii';
  private prevCells: string[] = [];

  async init(_termCols: number, _termRows: number): Promise<void> {
    this.prevCells = [];
  }

  pixelsPerCell(): { x: number; y: number } {
    return { x: 2, y: 4 };
  }

  maxPixelSize(termCols: number, termRows: number): { width: number; height: number } {
    return {
      width: termCols * 2,
      height: termRows * 4,
    };
  }

  renderFrame(pixels: PixelBuffer, offsetRow: number, offsetCol: number): FrameOutput {
    const cellCols = Math.ceil(pixels.width / 2);
    const cellRows = Math.ceil(pixels.height / 4);
    const cells: string[] = new Array(cellRows * cellCols);
    let output = '';

    for (let cellRow = 0; cellRow < cellRows; cellRow++) {
      for (let cellCol = 0; cellCol < cellCols; cellCol++) {
        let bitmask = 0;
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let onCount = 0;

        for (let dx = 0; dx < 2; dx++) {
          for (let dy = 0; dy < 4; dy++) {
            const px = cellCol * 2 + dx;
            const py = cellRow * 4 + dy;

            if (px >= pixels.width || py >= pixels.height) continue;

            const idx = (py * pixels.width + px) * 4;
            const r = pixels.data[idx];
            const g = pixels.data[idx + 1];
            const b = pixels.data[idx + 2];

            if (luminance(r, g, b) >= LUMINANCE_THRESHOLD) {
              bitmask |= BRAILLE_MAP[dx][dy];
              rSum += r;
              gSum += g;
              bSum += b;
              onCount++;
            }
          }
        }

        const brailleChar = String.fromCharCode(0x2800 + bitmask);
        let cell: string;

        if (onCount > 0) {
          const avgR = Math.round(rSum / onCount);
          const avgG = Math.round(gSum / onCount);
          const avgB = Math.round(bSum / onCount);
          cell = `\x1b[38;2;${avgR};${avgG};${avgB}m${brailleChar}`;
        } else {
          // All dots off — empty braille (blank)
          cell = `\x1b[38;2;0;0;0m${brailleChar}`;
        }

        cells[cellRow * cellCols + cellCol] = cell;
      }
    }

    // Diff-based rendering: only emit changed cells
    for (let cellRow = 0; cellRow < cellRows; cellRow++) {
      let rowHasChanges = false;
      let rowPayload = '';

      for (let cellCol = 0; cellCol < cellCols; cellCol++) {
        const idx = cellRow * cellCols + cellCol;
        const cell = cells[idx];
        const prevCell = this.prevCells[idx];

        if (cell !== prevCell) {
          if (!rowHasChanges) {
            // Position cursor at the start of this cell
            rowPayload += `\x1b[${offsetRow + cellRow + 1};${offsetCol + cellCol + 1}H`;
            rowHasChanges = true;
          } else {
            // If there was a gap of unchanged cells, reposition
            const prevIdx = idx - 1;
            const prevWasChanged = cells[prevIdx] !== this.prevCells[prevIdx];
            if (!prevWasChanged) {
              rowPayload += `\x1b[${offsetRow + cellRow + 1};${offsetCol + cellCol + 1}H`;
            }
          }
          rowPayload += cell;
        }
      }

      if (rowHasChanges) {
        output += rowPayload + RESET;
      }
    }

    this.prevCells = cells;

    return {
      payload: output,
      cursorRow: offsetRow + cellRows,
      cursorCol: 0,
    };
  }

  dispose(): void {
    this.prevCells = [];
  }
}
