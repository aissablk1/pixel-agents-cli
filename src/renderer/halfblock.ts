/**
 * Half-block renderer: uses ▀ (upper half block) with 24-bit ANSI colors.
 * Each terminal cell represents 2 vertical pixels:
 *   - Foreground color = top pixel
 *   - Background color = bottom pixel
 * Works in every modern terminal with truecolor support.
 */

import type { IRenderer, PixelBuffer, FrameOutput } from './types.js';

const UPPER_HALF = '\u2580'; // ▀
const RESET = '\x1b[0m';

export class HalfblockRenderer implements IRenderer {
  readonly name = 'halfblock';
  private prevFrame: string[] = [];

  async init(_termCols: number, _termRows: number): Promise<void> {
    this.prevFrame = [];
  }

  pixelsPerCell(): { x: number; y: number } {
    return { x: 1, y: 2 };
  }

  maxPixelSize(termCols: number, termRows: number): { width: number; height: number } {
    return {
      width: termCols,
      height: termRows * 2,
    };
  }

  renderFrame(pixels: PixelBuffer, offsetRow: number, offsetCol: number): FrameOutput {
    const lines: string[] = [];
    const outputRows = Math.ceil(pixels.height / 2);
    let output = '';

    for (let row = 0; row < outputRows; row++) {
      let line = `\x1b[${offsetRow + row + 1};${offsetCol + 1}H`; // Move cursor
      let prevFg = '';
      let prevBg = '';

      for (let col = 0; col < pixels.width; col++) {
        // Top pixel (foreground)
        const topY = row * 2;
        const topIdx = (topY * pixels.width + col) * 4;
        const tr = pixels.data[topIdx];
        const tg = pixels.data[topIdx + 1];
        const tb = pixels.data[topIdx + 2];

        // Bottom pixel (background)
        const botY = row * 2 + 1;
        let br: number, bg: number, bb: number;
        if (botY < pixels.height) {
          const botIdx = (botY * pixels.width + col) * 4;
          br = pixels.data[botIdx];
          bg = pixels.data[botIdx + 1];
          bb = pixels.data[botIdx + 2];
        } else {
          br = 0;
          bg = 0;
          bb = 0;
        }

        // Build ANSI escape — only emit color changes when needed
        const fgCode = `${tr};${tg};${tb}`;
        const bgCode = `${br};${bg};${bb}`;

        if (fgCode !== prevFg) {
          line += `\x1b[38;2;${fgCode}m`;
          prevFg = fgCode;
        }
        if (bgCode !== prevBg) {
          line += `\x1b[48;2;${bgCode}m`;
          prevBg = bgCode;
        }
        line += UPPER_HALF;
      }

      line += RESET;
      lines.push(line);
    }

    // Diff against previous frame — only emit changed lines
    for (let i = 0; i < lines.length; i++) {
      if (i >= this.prevFrame.length || lines[i] !== this.prevFrame[i]) {
        output += lines[i];
      }
    }
    this.prevFrame = lines;

    return {
      payload: output,
      cursorRow: offsetRow + outputRows,
      cursorCol: 0,
    };
  }

  dispose(): void {
    this.prevFrame = [];
  }
}
