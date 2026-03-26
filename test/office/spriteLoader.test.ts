import * as path from 'node:path';
import { loadAssets, getCharacterSprite } from '../../src/office/sprites/spriteLoader.js';
import type { LoadedAssets } from '../../src/office/sprites/spriteLoader.js';

const assetsDir = path.resolve(__dirname, '../../assets');

describe('loadAssets', () => {
  let assets: LoadedAssets;

  beforeAll(() => {
    assets = loadAssets(assetsDir);
  });

  it('loads characters (6 expected)', () => {
    expect(assets.characters).toHaveLength(6);
  });

  it('loads floors (9 expected: floor_0 through floor_8)', () => {
    expect(assets.floors).toHaveLength(9);
  });

  it('loads walls (at least 1)', () => {
    expect(assets.walls.length).toBeGreaterThanOrEqual(1);
  });

  it('each character has down, up, right, left directions', () => {
    for (const char of assets.characters) {
      expect(char.down).toBeDefined();
      expect(char.down.length).toBeGreaterThan(0);
      expect(char.up).toBeDefined();
      expect(char.up.length).toBeGreaterThan(0);
      expect(char.right).toBeDefined();
      expect(char.right.length).toBeGreaterThan(0);
      expect(char.left).toBeDefined();
      expect(char.left.length).toBeGreaterThan(0);
    }
  });

  it('left direction has same number of frames as right', () => {
    for (const char of assets.characters) {
      expect(char.left.length).toBe(char.right.length);
    }
  });

  it('each sprite is a 2D array of strings (16 cols, 32 rows)', () => {
    for (const char of assets.characters) {
      const frame = char.down[0];
      expect(frame.length).toBe(32);
      for (const row of frame) {
        expect(row.length).toBe(16);
        for (const pixel of row) {
          expect(typeof pixel).toBe('string');
        }
      }
    }
  });
});

describe('getCharacterSprite', () => {
  let assets: LoadedAssets;

  beforeAll(() => {
    assets = loadAssets(assetsDir);
  });

  it('with state idle returns a non-empty sprite', () => {
    const sprite = getCharacterSprite(assets, 0, 'idle', 0, 0);
    expect(sprite.length).toBeGreaterThan(0);
    expect(sprite[0].length).toBeGreaterThan(0);
  });

  it('with state type returns a non-empty sprite', () => {
    const sprite = getCharacterSprite(assets, 0, 'type', 0, 0);
    expect(sprite.length).toBeGreaterThan(0);
    expect(sprite[0].length).toBeGreaterThan(0);
  });

  it('with state walk returns a non-empty sprite', () => {
    const sprite = getCharacterSprite(assets, 0, 'walk', 0, 0);
    expect(sprite.length).toBeGreaterThan(0);
    expect(sprite[0].length).toBeGreaterThan(0);
  });

  it('with out-of-range palette wraps around', () => {
    const spriteNormal = getCharacterSprite(assets, 0, 'idle', 0, 0);
    const spriteWrapped = getCharacterSprite(assets, 6, 'idle', 0, 0);
    // palette 6 % 6 === 0, so they should be identical
    expect(spriteWrapped).toEqual(spriteNormal);
  });
});
