import { rasterize, compositeSprite } from '../../src/renderer/base.js';
import { createPixelBuffer } from '../../src/renderer/types.js';

describe('rasterize', () => {
  it('with empty drawables returns a buffer filled with background color', () => {
    const bg = { r: 10, g: 20, b: 30 };
    const buf = rasterize(4, 4, [], bg);
    for (let i = 0; i < 4 * 4; i++) {
      const idx = i * 4;
      expect(buf.data[idx]).toBe(bg.r);
      expect(buf.data[idx + 1]).toBe(bg.g);
      expect(buf.data[idx + 2]).toBe(bg.b);
      expect(buf.data[idx + 3]).toBe(255);
    }
  });

  it('with one drawable composites the sprite onto the buffer', () => {
    const sprite = [['#FF0000']];
    const buf = rasterize(4, 4, [{ sprite, x: 1, y: 1, zY: 0 }]);
    const idx = (1 * 4 + 1) * 4;
    expect(buf.data[idx]).toBe(255);
    expect(buf.data[idx + 1]).toBe(0);
    expect(buf.data[idx + 2]).toBe(0);
    expect(buf.data[idx + 3]).toBe(255);
  });

  it('z-sorting: drawable with lower zY is drawn first (behind)', () => {
    // Both drawables at the same position: the one with higher zY should be on top
    const spriteBack = [['#110000']];
    const spriteFront = [['#220000']];
    const buf = rasterize(4, 4, [
      { sprite: spriteFront, x: 0, y: 0, zY: 10 },
      { sprite: spriteBack, x: 0, y: 0, zY: 1 },
    ]);
    // The front sprite (zY=10) is drawn last, so its color wins
    expect(buf.data[0]).toBe(0x22);
    expect(buf.data[1]).toBe(0);
    expect(buf.data[2]).toBe(0);
  });

  it('buffer dimensions match width * height * 4', () => {
    const buf = rasterize(8, 6, []);
    expect(buf.width).toBe(8);
    expect(buf.height).toBe(6);
    expect(buf.data.length).toBe(8 * 6 * 4);
  });
});

describe('compositeSprite', () => {
  it('places pixels at the correct position', () => {
    const buf = createPixelBuffer(8, 8);
    const sprite = [['#AABBCC']];
    compositeSprite(buf, sprite, 3, 5);
    const idx = (5 * 8 + 3) * 4;
    expect(buf.data[idx]).toBe(0xAA);
    expect(buf.data[idx + 1]).toBe(0xBB);
    expect(buf.data[idx + 2]).toBe(0xCC);
    expect(buf.data[idx + 3]).toBe(255);
  });

  it('skips transparent pixels (empty strings)', () => {
    const buf = createPixelBuffer(4, 4);
    // Fill with a known color first
    for (let i = 0; i < 4 * 4 * 4; i += 4) {
      buf.data[i] = 0;
      buf.data[i + 1] = 0;
      buf.data[i + 2] = 0;
      buf.data[i + 3] = 0;
    }
    const sprite = [['', '#FF0000']];
    compositeSprite(buf, sprite, 0, 0);
    // Pixel (0,0) should remain untouched (transparent cell)
    expect(buf.data[0]).toBe(0);
    expect(buf.data[1]).toBe(0);
    expect(buf.data[2]).toBe(0);
    expect(buf.data[3]).toBe(0);
    // Pixel (1,0) should be red
    const idx = 1 * 4;
    expect(buf.data[idx]).toBe(255);
    expect(buf.data[idx + 1]).toBe(0);
    expect(buf.data[idx + 2]).toBe(0);
  });

  it('handles mirrored=true', () => {
    const buf = createPixelBuffer(4, 1);
    // Sprite: 3 columns [R, G, B] — mirrored should place B at col 0, G at col 1, R at col 2
    const sprite = [['#FF0000', '#00FF00', '#0000FF']];
    compositeSprite(buf, sprite, 0, 0, true);
    // With mirrored=true, col 0 of sprite -> destX + (cols-1-0) = destX+2
    // col 1 of sprite -> destX + (cols-1-1) = destX+1
    // col 2 of sprite -> destX + (cols-1-2) = destX+0
    // So pixel at x=2 should be red (col 0 of sprite)
    const idxX2 = 2 * 4;
    expect(buf.data[idxX2]).toBe(255);
    expect(buf.data[idxX2 + 1]).toBe(0);
    expect(buf.data[idxX2 + 2]).toBe(0);
    // Pixel at x=0 should be blue (col 2 of sprite)
    expect(buf.data[0]).toBe(0);
    expect(buf.data[1]).toBe(0);
    expect(buf.data[2]).toBe(255);
  });
});
