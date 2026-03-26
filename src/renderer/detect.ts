/**
 * Auto-detect terminal graphics capabilities.
 * Returns the best available renderer type for the current terminal.
 */

import type { RendererType } from './types.js';

export function detectBestRenderer(): RendererType {
  const termProgram = process.env.TERM_PROGRAM || '';
  const term = process.env.TERM || '';
  const colorTerm = process.env.COLORTERM || '';

  // Kitty terminal or Ghostty (both support Kitty graphics protocol)
  if (
    termProgram === 'kitty' ||
    termProgram === 'Ghostty' ||
    term.includes('kitty')
  ) {
    return 'kitty';
  }

  // WezTerm supports all protocols — prefer Kitty
  if (termProgram === 'WezTerm') {
    return 'kitty';
  }

  // iTerm2 supports Sixel
  if (termProgram === 'iTerm.app' || termProgram === 'iTerm2') {
    return 'sixel';
  }

  // foot terminal (Linux) supports Sixel
  if (termProgram === 'foot') {
    return 'sixel';
  }

  // Check for truecolor support (for halfblock)
  if (
    colorTerm === 'truecolor' ||
    colorTerm === '24bit' ||
    term.includes('256color')
  ) {
    return 'halfblock';
  }

  // Inside tmux/screen — use halfblock (safer)
  if (term.startsWith('screen') || term.startsWith('tmux')) {
    return 'halfblock';
  }

  // Default fallback
  return 'halfblock';
}
