/**
 * Title bar: shows app name, version, renderer type, and quit hint.
 */

import { ansi, type TerminalBuffer } from '../renderer/terminalBuffer.js';

export function renderTitleBar(
  buf: TerminalBuffer,
  rendererName: string,
  cols: number,
): void {
  const title = ' PIXEL AGENTS CLI v0.1.0';
  const info = `renderer: ${rendererName}  [q] quit `;
  const padding = Math.max(0, cols - title.length - info.length);

  const line =
    ansi.bg(25, 25, 40) +
    ansi.fg(120, 180, 255) +
    ansi.bold +
    title +
    ' '.repeat(padding) +
    ansi.reset +
    ansi.bg(25, 25, 40) +
    ansi.dim +
    info +
    ansi.reset;

  buf.writeAt(0, 0, line);
}
