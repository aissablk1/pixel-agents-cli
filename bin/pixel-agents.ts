/**
 * pixel-agents-cli entry point.
 * Terminal-native pixel art visualization of Claude Code agents.
 */

import { parseArgs } from '../src/cli/args.js';
import { startOrchestrator } from '../src/index.js';
import { SessionDiscoverer } from '../src/session/discoverer.js';
import type { RendererType } from '../src/renderer/types.js';

// Normalize common single-dash mistakes: -help → --help, -version → --version
const normalizedArgv = process.argv.map((arg) =>
  arg === '-help' ? '--help' : arg === '-version' ? '--version' : arg,
);
const opts = parseArgs(normalizedArgv);

// --list-sessions mode: print and exit
if (opts.listSessions) {
  const discoverer = new SessionDiscoverer();
  const sessions = discoverer.scan();

  if (sessions.length === 0) {
    console.log('No Claude Code sessions found.');
    process.exit(0);
  }

  console.log(`\nFound ${sessions.length} session(s):\n`);
  console.log(
    '  #  Active  Project                          Session ID                           Modified',
  );
  console.log('  ' + '-'.repeat(110));

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const active = s.isActive ? '\x1b[32m●\x1b[0m' : '\x1b[90m○\x1b[0m';
    const name = extractProjectName(s.projectPath).padEnd(30);
    const id = s.sessionId.padEnd(36);
    const modified = new Date(s.lastModified).toLocaleString('fr-FR');
    console.log(`  ${(i + 1).toString().padStart(2)}  ${active}      ${name}  ${id}  ${modified}`);
  }

  const activeCount = sessions.filter((s) => s.isActive).length;
  console.log(`\n  ${activeCount} active session(s)\n`);
  process.exit(0);
}

// Main mode: start the visualization
await startOrchestrator({
  renderer: opts.renderer as RendererType,
  fps: opts.fps,
  watchAll: opts.watchAll,
  projectFilter: opts.project,
});

function extractProjectName(projectPath: string): string {
  const parts = projectPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}
