/**
 * Terminal buffer management: alternate screen, cursor control, batched writes.
 */

const ESC = '\x1b';

export const ansi = {
  alternateScreenOn: `${ESC}[?1049h`,
  alternateScreenOff: `${ESC}[?1049l`,
  hideCursor: `${ESC}[?25l`,
  showCursor: `${ESC}[?25h`,
  clearScreen: `${ESC}[2J`,
  moveTo: (row: number, col: number) => `${ESC}[${row + 1};${col + 1}H`,
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  dim: `${ESC}[2m`,
  fg: (r: number, g: number, b: number) => `${ESC}[38;2;${r};${g};${b}m`,
  bg: (r: number, g: number, b: number) => `${ESC}[48;2;${r};${g};${b}m`,
  fgAnsi: (code: number) => `${ESC}[${code}m`,
  bgAnsi: (code: number) => `${ESC}[${code + 10}m`,
  clearLine: `${ESC}[2K`,
};

export class TerminalBuffer {
  private writeBuffer = '';
  private inAlternateScreen = false;

  /** Enter alternate screen buffer and hide cursor */
  enter(): void {
    if (this.inAlternateScreen) return;
    this.write(ansi.alternateScreenOn + ansi.hideCursor + ansi.clearScreen);
    this.flush();
    this.inAlternateScreen = true;
  }

  /** Exit alternate screen buffer, show cursor, restore terminal */
  exit(): void {
    if (!this.inAlternateScreen) return;
    this.write(ansi.showCursor + ansi.alternateScreenOff + ansi.reset);
    this.flush();
    this.inAlternateScreen = false;
  }

  /** Buffer a string for writing */
  write(s: string): void {
    this.writeBuffer += s;
  }

  /** Write a string at a specific position */
  writeAt(row: number, col: number, s: string): void {
    this.writeBuffer += ansi.moveTo(row, col) + s;
  }

  /** Clear a specific line */
  clearLineAt(row: number): void {
    this.writeBuffer += ansi.moveTo(row, 0) + ansi.clearLine;
  }

  /** Flush all buffered content to stdout */
  flush(): void {
    if (this.writeBuffer.length > 0) {
      process.stdout.write(this.writeBuffer);
      this.writeBuffer = '';
    }
  }

  /** Get terminal dimensions */
  getSize(): { cols: number; rows: number } {
    return {
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
    };
  }

  /** Check if we're in the alternate screen */
  isActive(): boolean {
    return this.inAlternateScreen;
  }
}
