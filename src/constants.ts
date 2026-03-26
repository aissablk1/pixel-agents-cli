/**
 * Constants for pixel-agents-cli.
 * Forked from pixel-agents/src/constants.ts — removed VS Code identifiers.
 * Merged with webview-ui/src/constants.ts for simulation/rendering constants.
 */

// ── Timing (ms) ──────────────────────────────────────────────
export const JSONL_POLL_INTERVAL_MS = 1000;
export const FILE_WATCHER_POLL_INTERVAL_MS = 500;
export const PROJECT_SCAN_INTERVAL_MS = 1000;
export const TOOL_DONE_DELAY_MS = 300;
export const PERMISSION_TIMER_DELAY_MS = 7000;
export const TEXT_IDLE_DELAY_MS = 5000;

// ── Session Discovery ────────────────────────────────────────
export const SESSION_ACTIVE_THRESHOLD_MS = 30_000;
export const SESSION_SCAN_INTERVAL_MS = 2000;
export const CLAUDE_PROJECTS_DIR = '.claude/projects';

// ── Display Truncation ──────────────────────────────────────
export const BASH_COMMAND_DISPLAY_MAX_LENGTH = 30;
export const TASK_DESCRIPTION_DISPLAY_MAX_LENGTH = 40;

// ── Layout Persistence ──────────────────────────────────────
export const LAYOUT_FILE_DIR = '.pixel-agents-cli';
export const LAYOUT_FILE_NAME = 'layout.json';
export const CONFIG_FILE_NAME = 'config.json';

// ── Grid & Layout ────────────────────────────────────────────
export const TILE_SIZE = 16;
export const DEFAULT_COLS = 20;
export const DEFAULT_ROWS = 11;
export const MAX_COLS = 64;
export const MAX_ROWS = 64;

// ── Character Animation ─────────────────────────────────────
export const WALK_SPEED_PX_PER_SEC = 48;
export const WALK_FRAME_DURATION_SEC = 0.15;
export const TYPE_FRAME_DURATION_SEC = 0.3;
export const WANDER_PAUSE_MIN_SEC = 2.0;
export const WANDER_PAUSE_MAX_SEC = 20.0;
export const WANDER_MOVES_BEFORE_REST_MIN = 3;
export const WANDER_MOVES_BEFORE_REST_MAX = 6;
export const SEAT_REST_MIN_SEC = 120.0;
export const SEAT_REST_MAX_SEC = 240.0;

// ── Matrix Effect ────────────────────────────────────────────
export const MATRIX_EFFECT_DURATION_SEC = 0.3;
export const MATRIX_TRAIL_LENGTH = 6;
export const MATRIX_SPRITE_COLS = 16;
export const MATRIX_SPRITE_ROWS = 24;

// ── Rendering ────────────────────────────────────────────────
export const CHARACTER_SITTING_OFFSET_PX = 6;
export const CHARACTER_Z_SORT_OFFSET = 0.5;
export const FALLBACK_FLOOR_COLOR = '#808080';

// ── Zoom ─────────────────────────────────────────────────────
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 10;

// ── Game Logic ───────────────────────────────────────────────
export const MAX_DELTA_TIME_SEC = 0.1;
export const WAITING_BUBBLE_DURATION_SEC = 2.0;
export const INACTIVE_SEAT_TIMER_MIN_SEC = 3.0;
export const INACTIVE_SEAT_TIMER_RANGE_SEC = 2.0;
export const PALETTE_COUNT = 6;
export const HUE_SHIFT_MIN_DEG = 45;
export const HUE_SHIFT_RANGE_DEG = 271;
export const AUTO_ON_FACING_DEPTH = 3;
export const AUTO_ON_SIDE_DEPTH = 2;

// ── Furniture Animation ─────────────────────────────────────
export const FURNITURE_ANIM_INTERVAL_SEC = 0.2;

// ── Floor Colors ─────────────────────────────────────────────
export const DEFAULT_FLOOR_COLOR = { h: 35, s: 30, b: 15, c: 0 };
export const DEFAULT_WALL_COLOR = { h: 240, s: 25, b: 0, c: 0 };

// ── Terminal Rendering ──────────────────────────────────────
export const TARGET_FPS_HALFBLOCK = 12;
export const TARGET_FPS_SIXEL = 15;
export const TARGET_FPS_KITTY = 15;
export const TARGET_FPS_ASCII = 10;
export const MAX_READ_BYTES = 65536;

// ── Status Bar ───────────────────────────────────────────────
export const STATUS_BAR_ROWS = 3;
export const TITLE_BAR_ROWS = 1;
export const SESSION_BAR_ROWS = 1;
