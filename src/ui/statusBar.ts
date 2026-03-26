/**
 * Status bar: displays agent name, state, and current tool activity.
 */

import { ansi, type TerminalBuffer } from '../renderer/terminalBuffer.js';
import type { SimpleCharacter } from '../engine/simpleOffice.js';
import { CharacterState } from '../engine/simpleOffice.js';

const STATE_ICONS: Record<string, string> = {
  type: '\u2726',  // ✦
  idle: '\u25CB',  // ○
  walk: '\u25C6',  // ◆
};

const PALETTE_COLORS: Array<[number, number, number]> = [
  [66, 133, 244],  // blue
  [234, 67, 53],   // red
  [52, 168, 83],   // green
  [251, 188, 4],   // yellow
  [171, 71, 188],  // purple
  [255, 112, 67],  // orange
];

export function renderStatusBar(
  buf: TerminalBuffer,
  characters: Map<number, SimpleCharacter>,
  startRow: number,
  cols: number,
): void {
  let row = startRow;

  // Separator
  buf.writeAt(row, 0, ansi.dim + '\u2500'.repeat(cols) + ansi.reset);
  row++;

  if (characters.size === 0) {
    buf.writeAt(row, 0, ansi.clearLine + ansi.dim + '  No active agents detected' + ansi.reset);
    return;
  }

  let agentNum = 1;
  for (const ch of characters.values()) {
    if (row >= (process.stdout.rows || 24) - 1) break;

    const [cr, cg, cb] = PALETTE_COLORS[ch.palette % PALETTE_COLORS.length];
    const icon = STATE_ICONS[ch.state] || '\u25CB';
    const stateLabel = ch.state === CharacterState.TYPE
      ? (ch.currentTool === 'Read' || ch.currentTool === 'Grep' || ch.currentTool === 'Glob'
        ? 'Reading'
        : 'Typing')
      : ch.state === CharacterState.WALK
        ? 'Walking'
        : 'Idle';

    const statusText = ch.currentStatus || '';
    const maxStatusLen = cols - 30;
    const truncatedStatus = statusText.length > maxStatusLen
      ? statusText.slice(0, maxStatusLen) + '\u2026'
      : statusText;

    const line =
      ansi.clearLine +
      `  ${ansi.fg(cr, cg, cb)}${ansi.bold}Agent ${agentNum}${ansi.reset}: ` +
      `${icon} ${stateLabel}` +
      (truncatedStatus ? ` | ${ansi.dim}${truncatedStatus}${ansi.reset}` : '');

    buf.writeAt(row, 0, line);
    row++;
    agentNum++;
  }
}
