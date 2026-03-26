/**
 * Sprite loader — loads all character, floor, and wall sprites from
 * bundled PNG assets at startup using the shared asset decoder.
 *
 * Generates "left" direction sprites by horizontally flipping "right" sprites.
 * Provides a lookup function to retrieve the correct SpriteData for a given
 * character state, direction, and animation frame.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodeAllCharacters, decodeAllFloors, decodeAllWalls } from '../../../shared/assets/loader.js';
import type { CharacterDirectionSprites } from '../../../shared/assets/types.js';

// ── Types ────────────────────────────────────────────────────

/** A single sprite frame: 2D array of hex color strings ('' = transparent) */
type SpriteData = string[][];

/** Character sprites with all four directions (including generated "left") */
export interface FullCharacterSprites {
  down: SpriteData[];
  up: SpriteData[];
  right: SpriteData[];
  left: SpriteData[];
}

/** All loaded assets ready for rendering */
export interface LoadedAssets {
  characters: FullCharacterSprites[];
  floors: SpriteData[];
  walls: SpriteData[][];
}

// ── Direction enum matching simpleOffice.ts ──────────────────

const DIR_DOWN = 0;
const DIR_LEFT = 1;
const DIR_RIGHT = 2;
const DIR_UP = 3;

// ── Sprite flipping ─────────────────────────────────────────

/** Horizontally flip a single sprite frame (mirror each row) */
function flipSpriteHorizontally(sprite: SpriteData): SpriteData {
  return sprite.map((row) => [...row].reverse());
}

// ── Loader ──────────────────────────────────────────────────

/**
 * Load all assets from disk.
 * @param assetsDir — optional override for the assets directory path.
 *   Defaults to `<package-root>/assets/`.
 */
export function loadAssets(assetsDir?: string): LoadedAssets {
  const dir =
    assetsDir ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets');

  // Decode raw PNG data
  const rawCharacters: CharacterDirectionSprites[] = decodeAllCharacters(dir);
  const rawFloors: SpriteData[] = decodeAllFloors(dir);
  const rawWalls: SpriteData[][] = decodeAllWalls(dir);

  // Build full four-direction character sprites
  const characters: FullCharacterSprites[] = rawCharacters.map((ch) => ({
    down: ch.down,
    up: ch.up,
    right: ch.right,
    left: ch.right.map(flipSpriteHorizontally),
  }));

  return {
    characters,
    floors: rawFloors,
    walls: rawWalls,
  };
}

// ── Sprite Lookup ───────────────────────────────────────────

/**
 * Frame index mapping per character state:
 * - TYPE:  frames 0-1 (typing animation, 2 frames)
 * - IDLE:  frame 0 (static)
 * - WALK:  frames 3-6 (walk cycle, 4 frames)
 *
 * The character PNG contains 7 frames per direction row:
 *   [0] idle/type-base  [1] type-alt  [2] unused  [3] walk-0  [4] walk-1  [5] walk-2  [6] walk-3
 */

/**
 * Get the appropriate SpriteData for a character given its current state.
 *
 * @param assets     — the loaded assets
 * @param palette    — character palette index (selects which character sprite set)
 * @param state      — 'type' | 'idle' | 'walk'
 * @param direction  — 0=DOWN, 1=LEFT, 2=RIGHT, 3=UP
 * @param frame      — animation frame counter (state-relative)
 * @returns the 2D hex color array for the requested sprite frame
 */
export function getCharacterSprite(
  assets: LoadedAssets,
  palette: number,
  state: string,
  direction: number,
  frame: number,
): SpriteData {
  // Clamp palette to available characters
  const charCount = assets.characters.length;
  if (charCount === 0) {
    return []; // No characters loaded — return empty sprite
  }
  const charSprites = assets.characters[palette % charCount];

  // Select direction frames
  let dirFrames: SpriteData[];
  switch (direction) {
    case DIR_DOWN:
      dirFrames = charSprites.down;
      break;
    case DIR_LEFT:
      dirFrames = charSprites.left;
      break;
    case DIR_RIGHT:
      dirFrames = charSprites.right;
      break;
    case DIR_UP:
      dirFrames = charSprites.up;
      break;
    default:
      dirFrames = charSprites.down;
      break;
  }

  if (dirFrames.length === 0) {
    return [];
  }

  // Map state + frame to the actual sprite frame index
  let spriteFrameIndex: number;

  switch (state) {
    case 'type':
      // Typing uses frames 0-1
      spriteFrameIndex = frame % 2;
      break;
    case 'walk':
      // Walking uses frames 3-6 (4 walk frames)
      spriteFrameIndex = 3 + (frame % 4);
      break;
    case 'idle':
    default:
      // Idle always uses frame 0
      spriteFrameIndex = 0;
      break;
  }

  // Clamp to available frames
  if (spriteFrameIndex >= dirFrames.length) {
    spriteFrameIndex = 0;
  }

  return dirFrames[spriteFrameIndex];
}
