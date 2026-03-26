/**
 * Simplified office state for the CLI MVP.
 * Manages characters on a grid with basic animations (TYPE/IDLE/WALK).
 * Full officeState.ts fork will come in Phase 4.
 */

import {
  TILE_SIZE,
  DEFAULT_COLS,
  DEFAULT_ROWS,
  WALK_SPEED_PX_PER_SEC,
  WALK_FRAME_DURATION_SEC,
  TYPE_FRAME_DURATION_SEC,
  WANDER_PAUSE_MIN_SEC,
  WANDER_PAUSE_MAX_SEC,
  PALETTE_COUNT,
  HUE_SHIFT_MIN_DEG,
  HUE_SHIFT_RANGE_DEG,
} from '../constants.js';

export const CharacterState = {
  IDLE: 'idle',
  WALK: 'walk',
  TYPE: 'type',
} as const;
type CharacterStateType = (typeof CharacterState)[keyof typeof CharacterState];

export const Direction = {
  DOWN: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3,
} as const;
type DirectionType = (typeof Direction)[keyof typeof Direction];

export interface SimpleCharacter {
  id: number;
  state: CharacterStateType;
  dir: DirectionType;
  x: number;
  y: number;
  tileCol: number;
  tileRow: number;
  frame: number;
  frameTimer: number;
  wanderTimer: number;
  isActive: boolean;
  currentTool: string | null;
  currentStatus: string | null;
  palette: number;
  hueShift: number;
  isSubagent: boolean;
  parentAgentId: number | null;
}

export class SimpleOffice {
  readonly cols: number;
  readonly rows: number;
  readonly characters = new Map<number, SimpleCharacter>();
  private nextPalette = 0;

  constructor(cols = DEFAULT_COLS, rows = DEFAULT_ROWS) {
    this.cols = cols;
    this.rows = rows;
  }

  /** Add a new character for an agent */
  addCharacter(id: number): SimpleCharacter {
    const palette = this.nextPalette % PALETTE_COUNT;
    const hueShift =
      this.nextPalette >= PALETTE_COUNT
        ? HUE_SHIFT_MIN_DEG + Math.random() * HUE_SHIFT_RANGE_DEG
        : 0;
    this.nextPalette++;

    // Place at a desk position (roughly center of office)
    const col = 3 + (this.characters.size * 3) % (this.cols - 6);
    const row = 3 + (this.characters.size * 2) % (this.rows - 4);

    const ch: SimpleCharacter = {
      id,
      state: CharacterState.IDLE,
      dir: Direction.DOWN,
      x: col * TILE_SIZE,
      y: row * TILE_SIZE,
      tileCol: col,
      tileRow: row,
      frame: 0,
      frameTimer: 0,
      wanderTimer: randomBetween(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC),
      isActive: false,
      currentTool: null,
      currentStatus: null,
      palette,
      hueShift,
      isSubagent: false,
      parentAgentId: null,
    };

    this.characters.set(id, ch);
    return ch;
  }

  /** Remove a character */
  removeCharacter(id: number): void {
    this.characters.delete(id);
  }

  /** Set agent as active (typing) */
  setActive(id: number, toolName: string | null, status: string | null): void {
    const ch = this.characters.get(id);
    if (!ch) return;
    ch.isActive = true;
    ch.currentTool = toolName;
    ch.currentStatus = status;
    if (ch.state !== CharacterState.TYPE) {
      ch.state = CharacterState.TYPE;
      ch.frame = 0;
      ch.frameTimer = 0;
      // Face down when typing
      ch.dir = Direction.DOWN;
    }
  }

  /** Set agent as waiting/idle */
  setIdle(id: number): void {
    const ch = this.characters.get(id);
    if (!ch) return;
    ch.isActive = false;
    ch.currentTool = null;
    ch.currentStatus = null;
    if (ch.state === CharacterState.TYPE) {
      ch.state = CharacterState.IDLE;
      ch.frame = 0;
      ch.frameTimer = 0;
      ch.wanderTimer = randomBetween(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
    }
  }

  /** Update all characters for one frame */
  update(dt: number): void {
    for (const ch of this.characters.values()) {
      switch (ch.state) {
        case CharacterState.TYPE:
          this.updateTyping(ch, dt);
          break;
        case CharacterState.IDLE:
          this.updateIdle(ch, dt);
          break;
        case CharacterState.WALK:
          this.updateWalking(ch, dt);
          break;
      }
    }
  }

  private updateTyping(ch: SimpleCharacter, dt: number): void {
    ch.frameTimer += dt;
    if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
      ch.frameTimer -= TYPE_FRAME_DURATION_SEC;
      ch.frame = (ch.frame + 1) % 2;
    }
  }

  private updateIdle(ch: SimpleCharacter, dt: number): void {
    ch.wanderTimer -= dt;
    if (ch.wanderTimer <= 0) {
      // Start a random walk
      ch.state = CharacterState.WALK;
      ch.frame = 0;
      ch.frameTimer = 0;

      // Pick a random adjacent tile
      const dirs = [
        { dc: 0, dr: 1, d: Direction.DOWN },
        { dc: 0, dr: -1, d: Direction.UP },
        { dc: 1, dr: 0, d: Direction.RIGHT },
        { dc: -1, dr: 0, d: Direction.LEFT },
      ];
      const pick = dirs[Math.floor(Math.random() * dirs.length)];
      const newCol = Math.max(1, Math.min(this.cols - 2, ch.tileCol + pick.dc));
      const newRow = Math.max(1, Math.min(this.rows - 2, ch.tileRow + pick.dr));

      ch.dir = pick.d;
      ch.tileCol = newCol;
      ch.tileRow = newRow;
    }
  }

  private updateWalking(ch: SimpleCharacter, dt: number): void {
    const targetX = ch.tileCol * TILE_SIZE;
    const targetY = ch.tileRow * TILE_SIZE;
    const dx = targetX - ch.x;
    const dy = targetY - ch.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) {
      ch.x = targetX;
      ch.y = targetY;
      ch.state = ch.isActive ? CharacterState.TYPE : CharacterState.IDLE;
      ch.frame = 0;
      ch.frameTimer = 0;
      ch.wanderTimer = randomBetween(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
    } else {
      const speed = WALK_SPEED_PX_PER_SEC * dt;
      const ratio = Math.min(speed / dist, 1);
      ch.x += dx * ratio;
      ch.y += dy * ratio;

      ch.frameTimer += dt;
      if (ch.frameTimer >= WALK_FRAME_DURATION_SEC) {
        ch.frameTimer -= WALK_FRAME_DURATION_SEC;
        ch.frame = (ch.frame + 1) % 4;
      }
    }
  }

  /** Get pixel dimensions of the office */
  getPixelSize(): { width: number; height: number } {
    return {
      width: this.cols * TILE_SIZE,
      height: this.rows * TILE_SIZE,
    };
  }
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
