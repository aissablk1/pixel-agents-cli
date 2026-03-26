/**
 * Renderer factory: creates the appropriate renderer based on type.
 */

import type { IRenderer, RendererType } from './types.js';
import { HalfblockRenderer } from './halfblock.js';
import { AsciiRenderer } from './ascii.js';
import { SixelRenderer } from './sixel.js';
import { KittyRenderer } from './kitty.js';
import { detectBestRenderer } from './detect.js';

export function createRenderer(type: RendererType): IRenderer {
  const resolvedType = type === 'auto' ? detectBestRenderer() : type;

  switch (resolvedType) {
    case 'halfblock':
      return new HalfblockRenderer();
    case 'sixel':
      return new SixelRenderer();
    case 'kitty':
      return new KittyRenderer();
    case 'ascii':
      return new AsciiRenderer();
    default:
      return new HalfblockRenderer();
  }
}
