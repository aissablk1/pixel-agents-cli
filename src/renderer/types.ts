/**
 * Renderer abstraction types for pixel-agents-cli.
 * Defines the interface that all rendering backends must implement.
 */

/** RGBA pixel buffer: flat Uint8Array, 4 bytes per pixel, row-major */
export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8Array;
}

/** A rendered frame ready for terminal output */
export interface FrameOutput {
  payload: string;
  cursorRow: number;
  cursorCol: number;
}

/** Rendering backend interface */
export interface IRenderer {
  readonly name: string;
  init(termCols: number, termRows: number): Promise<void>;
  renderFrame(pixels: PixelBuffer, offsetRow: number, offsetCol: number): FrameOutput;
  pixelsPerCell(): { x: number; y: number };
  maxPixelSize(termCols: number, termRows: number): { width: number; height: number };
  dispose(): void;
}

export const RendererType = {
  AUTO: 'auto',
  HALFBLOCK: 'halfblock',
  SIXEL: 'sixel',
  KITTY: 'kitty',
  ASCII: 'ascii',
} as const;
export type RendererType = (typeof RendererType)[keyof typeof RendererType];

export function createPixelBuffer(width: number, height: number): PixelBuffer {
  return {
    width,
    height,
    data: new Uint8Array(width * height * 4),
  };
}

/** Set a pixel in the buffer (with bounds checking) */
export function setPixel(
  buf: PixelBuffer,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  if (x < 0 || x >= buf.width || y < 0 || y >= buf.height) return;
  const idx = (y * buf.width + x) * 4;
  buf.data[idx] = r;
  buf.data[idx + 1] = g;
  buf.data[idx + 2] = b;
  buf.data[idx + 3] = a;
}

/** Alpha-composite a pixel onto the buffer */
export function blendPixel(
  buf: PixelBuffer,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  if (x < 0 || x >= buf.width || y < 0 || y >= buf.height) return;
  const idx = (y * buf.width + x) * 4;
  if (a >= 255) {
    buf.data[idx] = r;
    buf.data[idx + 1] = g;
    buf.data[idx + 2] = b;
    buf.data[idx + 3] = 255;
  } else {
    const alpha = a / 255;
    const invAlpha = 1 - alpha;
    buf.data[idx] = Math.round(r * alpha + buf.data[idx] * invAlpha);
    buf.data[idx + 1] = Math.round(g * alpha + buf.data[idx + 1] * invAlpha);
    buf.data[idx + 2] = Math.round(b * alpha + buf.data[idx + 2] * invAlpha);
    buf.data[idx + 3] = 255;
  }
}
