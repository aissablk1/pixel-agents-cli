/**
 * Session bar: shows active sessions at the bottom of the screen.
 */

import { ansi, type TerminalBuffer } from '../renderer/terminalBuffer.js';
import type { DiscoveredSession } from '../types.js';

export function renderSessionBar(
  buf: TerminalBuffer,
  sessions: DiscoveredSession[],
  watchedSessionIds: Set<string>,
  row: number,
  cols: number,
): void {
  if (sessions.length === 0) {
    buf.writeAt(
      row,
      0,
      ansi.bg(20, 20, 30) +
      ansi.dim +
      '  Scanning for Claude Code sessions...' +
      ' '.repeat(Math.max(0, cols - 40)) +
      ansi.reset,
    );
    return;
  }

  let line = ansi.bg(20, 20, 30) + '  ';
  let pos = 2;

  for (let i = 0; i < Math.min(sessions.length, 9); i++) {
    const s = sessions[i];
    const isWatched = watchedSessionIds.has(s.sessionId);
    const dot = isWatched ? '\u25CF' : '\u25CB'; // ● or ○
    const name = extractProjectName(s.projectPath);
    const branch = s.gitBranch ? ` (${s.gitBranch})` : '';
    const label = `[${i + 1}] ${name}${branch} ${dot}`;

    if (pos + label.length + 2 > cols) break;

    line += isWatched
      ? ansi.fg(100, 200, 120) + label + ansi.reset + ansi.bg(20, 20, 30)
      : ansi.dim + label + ansi.reset + ansi.bg(20, 20, 30);
    line += '  ';
    pos += label.length + 2;
  }

  line += ' '.repeat(Math.max(0, cols - pos)) + ansi.reset;
  buf.writeAt(row, 0, line);
}

function extractProjectName(projectPath: string): string {
  const parts = projectPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}
