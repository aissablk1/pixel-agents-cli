/**
 * Graceful cleanup: handles SIGINT, SIGTERM, and uncaught errors.
 * Ensures terminal state is restored on exit.
 */

import type { TerminalBuffer } from '../renderer/terminalBuffer.js';

export function setupCleanup(
  terminal: TerminalBuffer,
  onCleanup: () => void,
): void {
  let cleaning = false;

  const cleanup = () => {
    if (cleaning) return;
    cleaning = true;

    try {
      onCleanup();
    } catch {
      // Best effort
    }

    try {
      terminal.exit();
    } catch {
      // Ensure cursor is visible even if terminal buffer fails
      process.stdout.write('\x1b[?25h\x1b[?1049l\x1b[0m');
    }

    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', (err) => {
    try {
      onCleanup();
    } catch {
      // Best effort
    }
    try {
      terminal.exit();
    } catch {
      process.stdout.write('\x1b[?25h\x1b[?1049l\x1b[0m');
    }
    console.error('Uncaught exception:', err);
    process.exit(1);
  });
}

export function setupInputHandler(
  onQuit: () => void,
  onRefresh?: () => void,
  onKey?: (key: string) => void,
): () => void {
  if (!process.stdin.isTTY) return () => {};

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  const handler = (key: string) => {
    switch (key) {
      case 'q':
      case '\x03': // Ctrl+C
        onQuit();
        return;
      case 'r':
        onRefresh?.();
        return;
    }

    // Forward to extended key handler (zoom, session selection, etc.)
    onKey?.(key);
  };

  process.stdin.on('data', handler);

  return () => {
    process.stdin.removeListener('data', handler);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  };
}
