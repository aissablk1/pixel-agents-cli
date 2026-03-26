/**
 * Kitty graphics protocol renderer: transmits images as base64-encoded RGBA
 * data via escape sequences supported by Kitty, Ghostty, and WezTerm.
 *
 * Protocol:
 *   First chunk:  \x1b_Ga=T,f=32,s=<width>,v=<height>,m=1;<base64>\x1b\\
 *   Middle chunks: \x1b_Gm=1;<base64>\x1b\\
 *   Last chunk:   \x1b_Gm=0;<base64>\x1b\\
 *
 * f=32 means RGBA (32-bit), s=width, v=height.
 * m=1 means more data follows, m=0 means final chunk.
 *
 * For subsequent frames, the previous image is deleted and a new one sent.
 */

import type { IRenderer, PixelBuffer, FrameOutput } from './types.js';

/** Maximum base64 payload per chunk (4096 bytes as per protocol recommendation) */
const MAX_CHUNK_SIZE = 4096;

/** Node.js Buffer-based base64 encoding for raw bytes */
function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString('base64');
}

export class KittyRenderer implements IRenderer {
  readonly name = 'kitty';
  private hasImage = false;

  async init(_termCols: number, _termRows: number): Promise<void> {
    this.hasImage = false;
  }

  pixelsPerCell(): { x: number; y: number } {
    return { x: 8, y: 16 };
  }

  maxPixelSize(termCols: number, termRows: number): { width: number; height: number } {
    return {
      width: termCols * 8,
      height: termRows * 16,
    };
  }

  renderFrame(pixels: PixelBuffer, offsetRow: number, offsetCol: number): FrameOutput {
    const { width, height, data } = pixels;
    let output = '';

    // Delete previous image if one was sent
    if (this.hasImage) {
      // Delete all images on the virtual placement
      output += '\x1b_Ga=d,d=A\x1b\\';
    }

    // Move cursor to the target position
    output += `\x1b[${offsetRow + 1};${offsetCol + 1}H`;

    // Encode raw RGBA pixel data to base64
    const base64Data = toBase64(data);
    const totalLength = base64Data.length;

    if (totalLength <= MAX_CHUNK_SIZE) {
      // Single chunk — m=0 (no more data)
      output += `\x1b_Ga=T,f=32,s=${width},v=${height},m=0;${base64Data}\x1b\\`;
    } else {
      // Multi-chunk transmission
      let offset = 0;
      let isFirst = true;

      while (offset < totalLength) {
        const remaining = totalLength - offset;
        const chunkSize = Math.min(MAX_CHUNK_SIZE, remaining);
        const chunk = base64Data.substring(offset, offset + chunkSize);
        const isLast = offset + chunkSize >= totalLength;
        const moreFlag = isLast ? 0 : 1;

        if (isFirst) {
          output += `\x1b_Ga=T,f=32,s=${width},v=${height},m=${moreFlag};${chunk}\x1b\\`;
          isFirst = false;
        } else {
          output += `\x1b_Gm=${moreFlag};${chunk}\x1b\\`;
        }

        offset += chunkSize;
      }
    }

    this.hasImage = true;

    // Approximate terminal rows consumed by the image
    const rowsUsed = Math.ceil(height / 16);

    return {
      payload: output,
      cursorRow: offsetRow + rowsUsed,
      cursorCol: 0,
    };
  }

  dispose(): void {
    // Clean up: delete all Kitty images
    if (this.hasImage) {
      process.stdout.write('\x1b_Ga=d,d=A\x1b\\');
      this.hasImage = false;
    }
  }
}
