import { createPixelBuffer } from '../../src/renderer/types.js';
import { HalfblockRenderer } from '../../src/renderer/halfblock.js';

describe('HalfblockRenderer', () => {
  let renderer: HalfblockRenderer;

  beforeEach(async () => {
    renderer = new HalfblockRenderer();
    await renderer.init(80, 24);
  });

  afterEach(() => {
    renderer.dispose();
  });

  it('has name "halfblock"', () => {
    expect(renderer.name).toBe('halfblock');
  });

  it('pixelsPerCell() returns { x: 1, y: 2 }', () => {
    expect(renderer.pixelsPerCell()).toEqual({ x: 1, y: 2 });
  });

  it('maxPixelSize(80, 24) returns { width: 80, height: 48 }', () => {
    expect(renderer.maxPixelSize(80, 24)).toEqual({ width: 80, height: 48 });
  });

  it('renderFrame with a 4x4 solid red pixel buffer produces output containing ANSI color codes', () => {
    const buf = createPixelBuffer(4, 4);
    // Fill with solid red (R=255, G=0, B=0, A=255)
    for (let i = 0; i < buf.data.length; i += 4) {
      buf.data[i] = 255;
      buf.data[i + 1] = 0;
      buf.data[i + 2] = 0;
      buf.data[i + 3] = 255;
    }

    const result = renderer.renderFrame(buf, 0, 0);

    expect(result.payload).toContain('\x1b[');
    expect(result.payload).toContain('38;2;');
    expect(result.payload).toContain('48;2;');
    expect(result.payload.length).toBeGreaterThan(0);
  });

  it('renderFrame with all-black pixels produces output (not empty)', () => {
    const buf = createPixelBuffer(4, 4);
    // Buffer is already zeroed (all black with alpha=0), set alpha
    for (let i = 3; i < buf.data.length; i += 4) {
      buf.data[i] = 255;
    }

    const result = renderer.renderFrame(buf, 0, 0);

    expect(result.payload.length).toBeGreaterThan(0);
  });

  it('renderFrame diff: calling twice with same data produces less output the second time', () => {
    const buf = createPixelBuffer(4, 4);
    // Fill with a pattern
    for (let i = 0; i < buf.data.length; i += 4) {
      buf.data[i] = 128;
      buf.data[i + 1] = 64;
      buf.data[i + 2] = 32;
      buf.data[i + 3] = 255;
    }

    const first = renderer.renderFrame(buf, 0, 0);
    const second = renderer.renderFrame(buf, 0, 0);

    expect(first.payload.length).toBeGreaterThan(0);
    expect(second.payload.length).toBeLessThan(first.payload.length);
  });

  it('dispose() does not throw', () => {
    expect(() => renderer.dispose()).not.toThrow();
  });
});
