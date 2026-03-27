/**
 * Integration tests: full rendering pipeline comparison with original behavior.
 *
 * Verifies that the CLI produces correct output by testing the complete
 * pipeline: layout loading → sprite decoding → rasterization → terminal output.
 * Compares against expected behavior from the original pixel-agents VS Code extension.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadAssets, getCharacterSprite } from '../../src/office/sprites/spriteLoader.js';
import { setFloorSprites, getColorizedFloorSprite, getFloorSprite } from '../../src/office/floorTiles.js';
import { setWallSprites, getWallInstances } from '../../src/office/wallTiles.js';
import { rasterize } from '../../src/renderer/base.js';
import { createPixelBuffer } from '../../src/renderer/types.js';
import { HalfblockRenderer } from '../../src/renderer/halfblock.js';
import { computeLayout } from '../../src/ui/layout.js';
import { TILE_SIZE } from '../../src/constants.js';
import { buildFurnitureCatalog } from '../../shared/assets/build.js';
import { decodeAllFurniture } from '../../shared/assets/loader.js';
import type { OfficeLayout, FloorColor } from '../../src/office/types.js';
import type { Drawable } from '../../src/renderer/base.js';

const assetsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets');
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ── Layout Loading ──────────────────────────────────────────

describe('Layout loading', () => {
  const layoutPath = path.resolve(assetsDir, 'default-layout-1.json');
  let layout: OfficeLayout;

  beforeAll(() => {
    layout = JSON.parse(fs.readFileSync(layoutPath, 'utf-8'));
  });

  it('loads with correct dimensions (21x22 as in original)', () => {
    expect(layout.cols).toBe(21);
    expect(layout.rows).toBe(22);
  });

  it('has version 1', () => {
    expect(layout.version).toBe(1);
  });

  it('tiles array matches cols * rows', () => {
    expect(layout.tiles.length).toBe(layout.cols * layout.rows);
  });

  it('tileColors array matches tiles array', () => {
    expect(layout.tileColors).toBeDefined();
    expect(layout.tileColors!.length).toBe(layout.tiles.length);
  });

  it('has furniture placements', () => {
    expect(layout.furniture.length).toBeGreaterThan(0);
  });

  it('first 10 rows are VOID (255) matching original layout', () => {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < layout.cols; c++) {
        expect(layout.tiles[r * layout.cols + c]).toBe(255);
      }
    }
  });

  it('row 10 is all WALL (0) — top wall border', () => {
    const row10Start = 10 * layout.cols;
    for (let c = 0; c < 20; c++) {
      expect(layout.tiles[row10Start + c]).toBe(0);
    }
    expect(layout.tiles[row10Start + 20]).toBe(255);
  });

  it('contains floor tile types 1, 7, and 9 matching original zones', () => {
    const tileValues = new Set(layout.tiles);
    expect(tileValues.has(1)).toBe(true);
    expect(tileValues.has(7)).toBe(true);
    expect(tileValues.has(9)).toBe(true);
  });

  it('has furniture with desk and chair types', () => {
    const types = layout.furniture.map((f) => f.type);
    expect(types.some((t) => t.includes('DESK'))).toBe(true);
    expect(types.some((t) => t.includes('CHAIR') || t.includes('CUSHIONED'))).toBe(true);
  });
});

// ── Floor Tile Colorization ──────────────────────────────────

describe('Floor tile colorization (matching original Photoshop-style)', () => {
  beforeAll(() => {
    const assets = loadAssets(assetsDir);
    setFloorSprites(assets.floors);
  });

  it('getFloorSprite returns a 16x16 sprite for pattern index 1', () => {
    const sprite = getFloorSprite(1);
    expect(sprite).not.toBeNull();
    expect(sprite!.length).toBe(16);
    expect(sprite![0].length).toBe(16);
  });

  it('getFloorSprite returns null for pattern index 0 (WALL)', () => {
    expect(getFloorSprite(0)).toBeNull();
  });

  it('getColorizedFloorSprite applies HSL colorization', () => {
    const color: FloorColor = { h: 25, s: 48, b: -43, c: -88 };
    const sprite = getColorizedFloorSprite(7, color);
    expect(sprite.length).toBe(16);
    expect(sprite.some((row) => row.some((px) => px !== ''))).toBe(true);
  });

  it('colorized sprite differs from raw sprite', () => {
    const raw = getFloorSprite(1)!;
    const color: FloorColor = { h: 209, s: 39, b: -25, c: -80 };
    const colorized = getColorizedFloorSprite(1, color);

    let differs = false;
    for (let r = 0; r < 16 && !differs; r++) {
      for (let c = 0; c < 16 && !differs; c++) {
        if (raw[r][c] !== colorized[r][c]) differs = true;
      }
    }
    expect(differs).toBe(true);
  });

  it('different colors produce different sprites', () => {
    const c1: FloorColor = { h: 25, s: 48, b: -43, c: -88 };
    const c2: FloorColor = { h: 209, s: 39, b: -25, c: -80 };
    const s1 = getColorizedFloorSprite(1, c1);
    const s2 = getColorizedFloorSprite(1, c2);

    let differs = false;
    for (let r = 0; r < 16 && !differs; r++) {
      for (let c = 0; c < 16 && !differs; c++) {
        if (s1[r][c] !== s2[r][c]) differs = true;
      }
    }
    expect(differs).toBe(true);
  });
});

// ── Wall Auto-Tiling ─────────────────────────────────────────

describe('Wall auto-tiling (4-bit bitmask, matching original)', () => {
  let layout: OfficeLayout;
  let tileMap: number[][];

  beforeAll(() => {
    const assets = loadAssets(assetsDir);
    setWallSprites(assets.walls);
    layout = JSON.parse(fs.readFileSync(path.resolve(assetsDir, 'default-layout-1.json'), 'utf-8'));
    tileMap = [];
    for (let r = 0; r < layout.rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < layout.cols; c++) {
        row.push(layout.tiles[r * layout.cols + c]);
      }
      tileMap.push(row);
    }
  });

  it('produces wall instances for all WALL tiles', () => {
    const instances = getWallInstances(tileMap, layout.tileColors, layout.cols);
    let wallCount = 0;
    for (const tile of layout.tiles) {
      if (tile === 0) wallCount++;
    }
    expect(instances.length).toBe(wallCount);
  });

  it('wall sprites are 16px wide and up to 32px tall', () => {
    const instances = getWallInstances(tileMap, layout.tileColors, layout.cols);
    for (const inst of instances) {
      expect(inst.sprite[0].length).toBe(16);
      expect(inst.sprite.length).toBeLessThanOrEqual(32);
      expect(inst.sprite.length).toBeGreaterThan(0);
    }
  });

  it('colorization changes wall appearance', () => {
    const withColors = getWallInstances(tileMap, layout.tileColors, layout.cols);
    const withoutColors = getWallInstances(tileMap, undefined, layout.cols);

    let differs = false;
    for (let i = 0; i < Math.min(withColors.length, withoutColors.length) && !differs; i++) {
      const s1 = withColors[i].sprite;
      const s2 = withoutColors[i].sprite;
      for (let r = 0; r < s1.length && !differs; r++) {
        for (let c = 0; c < s1[r].length && !differs; c++) {
          if (s1[r][c] !== s2[r][c]) differs = true;
        }
      }
    }
    expect(differs).toBe(true);
  });
});

// ── Furniture Loading ────────────────────────────────────────

describe('Furniture loading and placement', () => {
  let layout: OfficeLayout;
  let furnitureSprites: Record<string, string[][]>;
  let catalog: ReturnType<typeof buildFurnitureCatalog>;

  beforeAll(() => {
    layout = JSON.parse(fs.readFileSync(path.resolve(assetsDir, 'default-layout-1.json'), 'utf-8'));
    catalog = buildFurnitureCatalog(assetsDir);
    furnitureSprites = decodeAllFurniture(assetsDir, catalog);
  });

  it('catalog has entries', () => {
    expect(catalog.length).toBeGreaterThan(0);
  });

  it('furniture sprites are decoded', () => {
    expect(Object.keys(furnitureSprites).length).toBeGreaterThan(0);
  });

  it('layout furniture resolves to decoded sprites (>50%)', () => {
    let resolved = 0;
    for (const furn of layout.furniture) {
      const assetId = furn.type.endsWith(':left') ? furn.type.slice(0, -5) : furn.type;
      if (furnitureSprites[assetId]) resolved++;
    }
    expect(resolved).toBeGreaterThan(layout.furniture.length * 0.5);
  });
});

// ── Full Rendering Pipeline ──────────────────────────────────

describe('Full rendering pipeline (layout → drawables → pixels)', () => {
  let layout: OfficeLayout;
  let assets: ReturnType<typeof loadAssets>;

  beforeAll(() => {
    assets = loadAssets(assetsDir);
    setFloorSprites(assets.floors);
    setWallSprites(assets.walls);
    layout = JSON.parse(fs.readFileSync(path.resolve(assetsDir, 'default-layout-1.json'), 'utf-8'));
  });

  it('rasterizes the full office at zoom 1 without errors', () => {
    const drawables: Drawable[] = [];

    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const tile = layout.tiles[r * layout.cols + c];
        if (tile === 255 || tile === 0) continue;
        const colorIdx = r * layout.cols + c;
        const color = layout.tileColors?.[colorIdx];
        const sprite = color ? getColorizedFloorSprite(tile, color) : getFloorSprite(tile);
        if (!sprite) continue;
        drawables.push({ sprite, x: c * TILE_SIZE, y: r * TILE_SIZE, zY: -1 });
      }
    }

    const tileMap: number[][] = [];
    for (let r = 0; r < layout.rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < layout.cols; c++) {
        row.push(layout.tiles[r * layout.cols + c]);
      }
      tileMap.push(row);
    }
    const wallInst = getWallInstances(tileMap, layout.tileColors, layout.cols);
    for (const w of wallInst) {
      drawables.push({ sprite: w.sprite, x: w.x, y: w.y, zY: w.zY });
    }

    const charSprite = getCharacterSprite(assets, 0, 'idle', 0, 0);
    drawables.push({
      sprite: charSprite,
      x: 5 * TILE_SIZE,
      y: 12 * TILE_SIZE - 16,
      zY: 12 * TILE_SIZE,
    });

    const width = layout.cols * TILE_SIZE;
    const height = layout.rows * TILE_SIZE;
    const pixels = rasterize(width, height, drawables);

    expect(pixels.width).toBe(width);
    expect(pixels.height).toBe(height);
    expect(pixels.data.length).toBe(width * height * 4);

    let nonBgPixels = 0;
    for (let i = 0; i < pixels.data.length; i += 4) {
      if (pixels.data[i] > 40 || pixels.data[i + 1] > 40 || pixels.data[i + 2] > 50) {
        nonBgPixels++;
      }
    }
    expect(nonBgPixels).toBeGreaterThan(width * height * 0.1);
  });

  it('VOID area (top rows) remains background color', () => {
    const drawables: Drawable[] = [];
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const tile = layout.tiles[r * layout.cols + c];
        if (tile === 255 || tile === 0) continue;
        const sprite = getFloorSprite(tile);
        if (!sprite) continue;
        drawables.push({ sprite, x: c * TILE_SIZE, y: r * TILE_SIZE, zY: -1 });
      }
    }

    const width = layout.cols * TILE_SIZE;
    const height = layout.rows * TILE_SIZE;
    const pixels = rasterize(width, height, drawables);

    const checkY = 5 * TILE_SIZE + 8;
    const checkX = 10 * TILE_SIZE + 8;
    const idx = (checkY * width + checkX) * 4;
    expect(pixels.data[idx]).toBe(30);
    expect(pixels.data[idx + 1]).toBe(30);
    expect(pixels.data[idx + 2]).toBe(40);
  });

  it('floor area (row 11) has colored pixels', () => {
    const drawables: Drawable[] = [];
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const tile = layout.tiles[r * layout.cols + c];
        if (tile === 255 || tile === 0) continue;
        const colorIdx = r * layout.cols + c;
        const color = layout.tileColors?.[colorIdx];
        const sprite = color ? getColorizedFloorSprite(tile, color) : getFloorSprite(tile);
        if (!sprite) continue;
        drawables.push({ sprite, x: c * TILE_SIZE, y: r * TILE_SIZE, zY: -1 });
      }
    }

    const width = layout.cols * TILE_SIZE;
    const height = layout.rows * TILE_SIZE;
    const pixels = rasterize(width, height, drawables);

    const checkY = 11 * TILE_SIZE + 8;
    const checkX = 5 * TILE_SIZE + 8;
    const idx = (checkY * width + checkX) * 4;
    const isBg = pixels.data[idx] === 30 && pixels.data[idx + 1] === 30 && pixels.data[idx + 2] === 40;
    expect(isBg).toBe(false);
  });
});

// ── Renderer at Different Terminal Sizes ─────────────────────

describe('Halfblock renderer at different terminal sizes', () => {
  it('renders at 80x24 (standard)', async () => {
    const renderer = new HalfblockRenderer();
    await renderer.init(80, 24);

    const buf = createPixelBuffer(80, 48);
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 80; x++) {
        const idx = (y * 80 + x) * 4;
        buf.data[idx] = Math.round((x / 80) * 255);
        buf.data[idx + 1] = Math.round((y / 48) * 255);
        buf.data[idx + 2] = 128;
        buf.data[idx + 3] = 255;
      }
    }

    const frame = renderer.renderFrame(buf, 0, 0);
    expect(frame.payload.length).toBeGreaterThan(0);
    expect(frame.payload).toContain('\x1b[38;2;');
    renderer.dispose();
  });

  it('renders at 40x10 (minimum)', async () => {
    const renderer = new HalfblockRenderer();
    await renderer.init(40, 10);
    const buf = createPixelBuffer(40, 20);
    for (let i = 0; i < buf.data.length; i += 4) {
      buf.data[i] = 100; buf.data[i + 1] = 50; buf.data[i + 2] = 200; buf.data[i + 3] = 255;
    }
    const frame = renderer.renderFrame(buf, 0, 0);
    expect(frame.payload.length).toBeGreaterThan(0);
    renderer.dispose();
  });

  it('diff rendering produces less output on unchanged frames', async () => {
    const renderer = new HalfblockRenderer();
    await renderer.init(80, 24);
    const buf = createPixelBuffer(80, 48);
    for (let i = 0; i < buf.data.length; i += 4) {
      buf.data[i] = 100; buf.data[i + 1] = 100; buf.data[i + 2] = 100; buf.data[i + 3] = 255;
    }
    const frame1 = renderer.renderFrame(buf, 0, 0);
    const frame2 = renderer.renderFrame(buf, 0, 0);
    expect(frame2.payload.length).toBeLessThan(frame1.payload.length);
    renderer.dispose();
  });
});

// ── Layout Regions at Different Sizes ────────────────────────

describe('Layout regions adapt to terminal size', () => {
  it('80x24: office has space', () => {
    const l = computeLayout(80, 24, 1);
    expect(l.office.rows).toBeGreaterThan(10);
    expect(l.office.row).toBe(1);
    expect(l.sessionBar.row).toBe(23);
  });

  it('120x40: larger office', () => {
    const l = computeLayout(120, 40, 2);
    expect(l.office.rows).toBeGreaterThan(25);
  });

  it('40x10: minimal valid', () => {
    const l = computeLayout(40, 10, 0);
    expect(l.office.rows).toBeGreaterThanOrEqual(4);
    expect(l.sessionBar.row).toBe(9);
  });

  it('taller terminal → larger office', () => {
    const small = computeLayout(80, 20, 1);
    const large = computeLayout(80, 40, 1);
    expect(large.office.rows).toBeGreaterThan(small.office.rows);
  });
});

// ── Character Sprites Match Original Format ──────────────────

describe('Character sprites match original format', () => {
  let assets: ReturnType<typeof loadAssets>;

  beforeAll(() => {
    assets = loadAssets(assetsDir);
  });

  it('6 characters (char_0 through char_5)', () => {
    expect(assets.characters.length).toBe(6);
  });

  it('7 frames per direction (original PNG layout)', () => {
    for (const ch of assets.characters) {
      expect(ch.down.length).toBe(7);
      expect(ch.up.length).toBe(7);
      expect(ch.right.length).toBe(7);
      expect(ch.left.length).toBe(7);
    }
  });

  it('frames are 16x32 (CHAR_FRAME_W x CHAR_FRAME_H)', () => {
    const frame = assets.characters[0].down[0];
    expect(frame[0].length).toBe(16);
    expect(frame.length).toBe(32);
  });

  it('typing animation frames differ', () => {
    const f0 = getCharacterSprite(assets, 0, 'type', 0, 0);
    const f1 = getCharacterSprite(assets, 0, 'type', 0, 1);
    let differs = false;
    for (let r = 0; r < f0.length && !differs; r++) {
      for (let c = 0; c < f0[r].length && !differs; c++) {
        if (f0[r][c] !== f1[r][c]) differs = true;
      }
    }
    expect(differs).toBe(true);
  });

  it('left sprites are mirrored from right', () => {
    const right = assets.characters[0].right[0];
    const left = assets.characters[0].left[0];
    for (let r = 0; r < right.length; r++) {
      expect(left[r]).toEqual([...right[r]].reverse());
    }
  });
});

// ── CLI Subprocess Tests ─────────────────────────────────────

describe('CLI subprocess', () => {
  it('--list-sessions returns valid output', () => {
    const output = execFileSync('npx', ['tsx', 'bin/pixel-agents.ts', '--list-sessions'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 15000,
    });
    expect(output).toContain('session(s)');
    expect(output).toContain('Session ID');
  });

  it('--version returns 0.1.0', () => {
    const output = execFileSync('npx', ['tsx', 'bin/pixel-agents.ts', '--version'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });
    expect(output.trim()).toBe('0.1.0');
  });

  it('interactive mode starts and stops cleanly', async () => {
    const result = await new Promise<{ stdout: number; stderr: string; code: number | null }>(
      (resolve) => {
        const proc = spawn('npx', ['tsx', 'bin/pixel-agents.ts', '--watch-all'], {
          cwd: projectRoot,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdoutLen = 0;
        let stderr = '';
        proc.stdout.on('data', (d: Buffer) => { stdoutLen += d.length; });
        proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

        setTimeout(() => proc.kill('SIGTERM'), 2000);
        proc.on('close', (code) => resolve({ stdout: stdoutLen, stderr, code }));
      },
    );

    expect(result.stdout).toBeGreaterThan(1000);
    expect(result.stderr).toBe('');
  }, 15000);
});
