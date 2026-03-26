/**
 * CLI argument parsing using Commander.js.
 */

import { Command } from 'commander';
import { RendererType } from '../renderer/types.js';

export interface CliOptions {
  renderer: string;
  project?: string;
  session?: string;
  fps: number;
  zoom?: number;
  layout?: string;
  listSessions: boolean;
  watchAll: boolean;
}

export function parseArgs(argv: string[]): CliOptions {
  const program = new Command();

  program
    .name('pixel-agents')
    .description('Terminal-native pixel art visualization of Claude Code agents')
    .version('0.1.0')
    .option(
      '-r, --renderer <type>',
      `Rendering backend: ${Object.values(RendererType).join('|')}`,
      'auto',
    )
    .option('-p, --project <path>', 'Watch a specific project directory')
    .option('-s, --session <id>', 'Watch a specific session ID')
    .option('--fps <number>', 'Target frame rate', '12')
    .option('--zoom <number>', 'Zoom level override')
    .option('--layout <file>', 'Custom office layout JSON file')
    .option('--list-sessions', 'List all discoverable sessions and exit', false)
    .option('--watch-all', 'Watch all active sessions', false);

  program.parse(argv);
  const opts = program.opts();

  return {
    renderer: opts.renderer,
    project: opts.project,
    session: opts.session,
    fps: parseInt(opts.fps, 10) || 12,
    zoom: opts.zoom ? parseInt(opts.zoom, 10) : undefined,
    listSessions: opts.listSessions || false,
    watchAll: opts.watchAll || false,
  };
}
