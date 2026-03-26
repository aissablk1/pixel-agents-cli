/**
 * Main orchestrator: wires session discovery, office simulation, and rendering.
 * Uses real sprites loaded from bundled PNG assets.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SessionDiscoverer } from './session/discoverer.js';
import { SimpleOffice } from './engine/simpleOffice.js';
import { startGameLoop } from './engine/gameLoop.js';
import { createRenderer } from './renderer/factory.js';
import { rasterize } from './renderer/base.js';
import { TerminalBuffer } from './renderer/terminalBuffer.js';
import { computeLayout } from './ui/layout.js';
import { renderTitleBar } from './ui/titleBar.js';
import { renderStatusBar } from './ui/statusBar.js';
import { renderSessionBar } from './ui/sessionBar.js';
import { setupCleanup, setupInputHandler } from './cli/cleanup.js';
import { TARGET_FPS_HALFBLOCK, TILE_SIZE, ZOOM_MIN, ZOOM_MAX } from './constants.js';
import { loadAssets, getCharacterSprite } from './office/sprites/spriteLoader.js';
import type { LoadedAssets } from './office/sprites/spriteLoader.js';
import type { AgentEvent, DiscoveredSession } from './types.js';
import type { RendererType } from './renderer/types.js';
import type { Drawable } from './renderer/base.js';

export interface OrchestratorOptions {
  renderer: RendererType;
  fps?: number;
  watchAll?: boolean;
  projectFilter?: string;
}

export async function startOrchestrator(opts: OrchestratorOptions): Promise<void> {
  // ── Load assets ──────────────────────────────────────────
  const defaultAssetsDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'assets',
  );
  let assets: LoadedAssets;
  try {
    assets = loadAssets(defaultAssetsDir);
  } catch (err) {
    // Fall back gracefully — assets may be missing in dev
    console.error('Failed to load assets:', err);
    assets = { characters: [], floors: [], walls: [] };
  }

  // ── Terminal & renderer ──────────────────────────────────
  const terminal = new TerminalBuffer();
  let { cols, rows } = terminal.getSize();

  const renderer = createRenderer(opts.renderer);
  await renderer.init(cols, rows);

  // ── Zoom state ───────────────────────────────────────────
  /** null = auto-fit, number = manual override */
  let manualZoom: number | null = null;

  // ── Office simulation ────────────────────────────────────
  const office = new SimpleOffice();

  // ── Session discovery ────────────────────────────────────
  const discoverer = new SessionDiscoverer();

  const watchedSessionIds = new Set<string>();
  let allSessions: DiscoveredSession[] = [];

  discoverer.on('agentEvent', (event: AgentEvent) => {
    switch (event.type) {
      case 'agentCreated': {
        office.addCharacter(event.id);
        // Update session tracking for the UI
        const agent = discoverer.agents.get(event.id);
        if (agent) {
          watchedSessionIds.add(agent.sessionId);
          allSessions = discoverer.scan();
        }
        break;
      }
      case 'agentClosed':
        office.removeCharacter(event.id);
        break;
      case 'agentStatus':
        if (event.status === 'active') {
          // Will be set to typing when tool starts
        } else {
          office.setIdle(event.id);
        }
        break;
      case 'agentToolStart':
        office.setActive(event.id, extractToolName(event.status), event.status);
        break;
      case 'agentToolDone': {
        const agent = discoverer.agents.get(event.id);
        if (agent && agent.activeToolIds.size === 0) {
          office.setIdle(event.id);
        }
        break;
      }
      case 'agentToolsClear':
        office.setIdle(event.id);
        break;
    }
  });

  // ── Enter alternate screen ───────────────────────────────
  terminal.enter();

  // ── Cleanup wiring ───────────────────────────────────────
  let gameLoop: { stop: () => void } | null = null;
  let cleanupInput: (() => void) | null = null;

  const cleanup = () => {
    gameLoop?.stop();
    cleanupInput?.();
    discoverer.dispose();
    renderer.dispose();
  };

  setupCleanup(terminal, cleanup);

  // ── SIGWINCH: handle terminal resize ─────────────────────
  process.on('SIGWINCH', () => {
    const size = terminal.getSize();
    cols = size.cols;
    rows = size.rows;
    renderer.init(cols, rows).catch(() => {
      // Best effort re-init
    });
  });

  // ── Input handling ───────────────────────────────────────
  cleanupInput = setupInputHandler(
    () => {
      cleanup();
      terminal.exit();
      process.exit(0);
    },
    () => {
      // Refresh: rescan sessions
      allSessions = discoverer.scan();
    },
    (key: string) => {
      // Extended key handler
      switch (key) {
        case '+':
        case '=':
          // Zoom in
          if (manualZoom === null) {
            manualZoom = 2;
          } else if (manualZoom < ZOOM_MAX) {
            manualZoom++;
          }
          break;
        case '-':
          // Zoom out
          if (manualZoom !== null && manualZoom > ZOOM_MIN) {
            manualZoom--;
            if (manualZoom <= ZOOM_MIN) {
              manualZoom = null; // Return to auto-fit
            }
          }
          break;
        case '0':
          // Reset to auto-fit
          manualZoom = null;
          break;
      }
    },
  );

  // ── Initial scan and watch ───────────────────────────────
  allSessions = discoverer.scan();
  const activeSessions = allSessions.filter((s) => s.isActive);

  if (activeSessions.length > 0) {
    discoverer.watchSessions(activeSessions);
    for (const s of activeSessions) {
      watchedSessionIds.add(s.sessionId);
    }
  }

  discoverer.startPeriodicScan();

  // ── Game loop ────────────────────────────────────────────
  const fps = opts.fps || TARGET_FPS_HALFBLOCK;

  gameLoop = startGameLoop(fps, {
    update(dt: number) {
      office.update(dt);
    },
    render() {
      const { cols: termCols, rows: termRows } = terminal.getSize();

      // Skip rendering if terminal is too small
      if (termCols < 40 || termRows < 10) {
        terminal.writeAt(0, 0, 'Terminal too small. Resize to at least 40x10.');
        terminal.flush();
        return;
      }

      const layout = computeLayout(termCols, termRows, office.characters.size);

      // Render title bar
      renderTitleBar(terminal, renderer.name, layout.titleBar.cols);

      // Render office grid
      const officePixelSize = office.getPixelSize();
      const ppc = renderer.pixelsPerCell();

      // Calculate how many pixels we can fit in the office region
      const maxW = layout.office.cols * ppc.x;
      const maxH = layout.office.rows * ppc.y;

      // Determine zoom level
      let zoom: number;
      if (manualZoom !== null) {
        zoom = manualZoom;
      } else {
        // Auto-fit zoom
        const zoomX = Math.floor(maxW / officePixelSize.width) || 1;
        const zoomY = Math.floor(maxH / officePixelSize.height) || 1;
        zoom = Math.max(ZOOM_MIN, Math.min(zoomX, zoomY, 4));
      }

      const renderW = officePixelSize.width * zoom;
      const renderH = officePixelSize.height * zoom;

      // Build drawables from characters
      const drawables: Drawable[] = [];
      for (const ch of office.characters.values()) {
        let sprite: string[][];

        if (assets.characters.length > 0) {
          // Use real sprites from loaded assets
          const rawSprite = getCharacterSprite(assets, ch.palette, ch.state, ch.dir, ch.frame);
          sprite = zoom === 1 ? rawSprite : scaleSprite(rawSprite, zoom);
        } else {
          // Fallback to placeholder if no assets loaded
          const rawSprite = createFallbackCharacterSprite(ch.palette, ch.state === 'type', ch.frame);
          sprite = zoom === 1 ? rawSprite : scaleSprite(rawSprite, zoom);
        }

        drawables.push({
          sprite,
          x: Math.round(ch.x * zoom),
          y: Math.round((ch.y - 16) * zoom), // Characters are 16x32, offset up
          zY: ch.y * zoom,
        });
      }

      // Add floor tile drawables
      const floorDrawables = createFloorDrawables(office.cols, office.rows, zoom, assets);
      drawables.push(...floorDrawables);

      // Rasterize to PixelBuffer
      const pixels = rasterize(renderW, renderH, drawables);

      // Render to terminal
      const offsetCol = Math.floor((layout.office.cols - renderW / ppc.x) / 2);
      const frame = renderer.renderFrame(pixels, layout.office.row, Math.max(0, offsetCol));
      terminal.write(frame.payload);

      // Render status bar
      renderStatusBar(terminal, office.characters, layout.statusBar.row, layout.statusBar.cols);

      // Render session bar
      renderSessionBar(terminal, allSessions, watchedSessionIds, layout.sessionBar.row, layout.sessionBar.cols);

      // Flush everything
      terminal.flush();
    },
  });
}

/** Extract tool name from status string like "Reading foo.ts" */
function extractToolName(status: string): string | null {
  if (status.startsWith('Reading')) return 'Read';
  if (status.startsWith('Editing')) return 'Edit';
  if (status.startsWith('Writing')) return 'Write';
  if (status.startsWith('Running:')) return 'Bash';
  if (status.startsWith('Searching files')) return 'Glob';
  if (status.startsWith('Searching code')) return 'Grep';
  if (status.startsWith('Searching the web')) return 'WebSearch';
  if (status.startsWith('Fetching web')) return 'WebFetch';
  if (status.startsWith('Subtask:')) return 'Agent';
  if (status.startsWith('Planning')) return 'EnterPlanMode';
  return null;
}

/** Create floor tile drawables using real assets or fallback */
function createFloorDrawables(
  cols: number,
  rows: number,
  zoom: number,
  assets: LoadedAssets,
): Drawable[] {
  const drawables: Drawable[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let tileSprite: string[][];

      if (assets.floors.length > 0) {
        // Use real floor tiles — alternate between available tiles
        const tileIndex = (r + c) % assets.floors.length;
        tileSprite = assets.floors[tileIndex];
      } else {
        // Fallback checkerboard
        tileSprite = createFallbackFloorTile();
      }

      const scaledSprite = zoom === 1 ? tileSprite : scaleSprite(tileSprite, zoom);

      drawables.push({
        sprite: scaledSprite,
        x: c * TILE_SIZE * zoom,
        y: r * TILE_SIZE * zoom,
        zY: -1, // Floor is always behind everything
      });
    }
  }

  return drawables;
}

/** Fallback floor tile when no assets are available */
function createFallbackFloorTile(): string[][] {
  const sprite: string[][] = [];
  for (let r = 0; r < TILE_SIZE; r++) {
    const line: string[] = [];
    for (let c = 0; c < TILE_SIZE; c++) {
      const isLight = (r + c) % 4 < 2;
      line.push(isLight ? '#3d3526' : '#352e21');
    }
    sprite.push(line);
  }
  return sprite;
}

/** Fallback character sprite when no assets are available */
function createFallbackCharacterSprite(
  palette: number,
  isTyping: boolean,
  frame: number,
): string[][] {
  const colors: string[] = [
    '#4285f4', '#ea4335', '#34a853', '#fbbc04', '#ab47bc', '#ff7043',
  ];
  const color = colors[palette % colors.length];
  const skinColor = '#ffcc99';
  const hairColor = '#553322';

  const sprite: string[][] = [];
  for (let row = 0; row < 32; row++) {
    const line: string[] = [];
    for (let col = 0; col < 16; col++) {
      if (row >= 2 && row <= 9 && col >= 4 && col <= 11) {
        if (row <= 4 && col >= 5 && col <= 10) {
          line.push(hairColor);
        } else if (row >= 5 && row <= 8 && col >= 5 && col <= 10) {
          line.push(skinColor);
        } else {
          line.push('');
        }
      } else if (row >= 10 && row <= 22 && col >= 4 && col <= 11) {
        line.push(color);
      } else if (row >= 12 && row <= 20 && (col === 3 || col === 12)) {
        if (isTyping && frame === 1) {
          line.push(col === 3 ? color : '');
        } else {
          line.push(color);
        }
      } else if (row >= 23 && row <= 29 && ((col >= 5 && col <= 7) || (col >= 9 && col <= 11))) {
        line.push('#333366');
      } else if (row >= 30 && col >= 4 && col <= 11) {
        if ((col >= 4 && col <= 7) || (col >= 9 && col <= 11)) {
          line.push('#554433');
        } else {
          line.push('');
        }
      } else {
        line.push('');
      }
    }
    sprite.push(line);
  }

  return sprite;
}

/** Scale a sprite by integer factor (nearest neighbor) */
function scaleSprite(sprite: string[][], factor: number): string[][] {
  const scaled: string[][] = [];
  for (const row of sprite) {
    const scaledRow: string[] = [];
    for (const pixel of row) {
      for (let i = 0; i < factor; i++) {
        scaledRow.push(pixel);
      }
    }
    for (let i = 0; i < factor; i++) {
      scaled.push([...scaledRow]);
    }
  }
  return scaled;
}
