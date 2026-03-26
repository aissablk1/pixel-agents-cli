/**
 * Configuration file management.
 * Reads/writes ~/.pixel-agents-cli/config.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { LAYOUT_FILE_DIR } from '../constants.js';

export interface CliConfig {
  renderer: string;
  fps: number;
  zoom: number | null;
  watchAll: boolean;
  maxAgents: number;
  showSubagents: boolean;
}

const DEFAULT_CONFIG: CliConfig = {
  renderer: 'auto',
  fps: 12,
  zoom: null,
  watchAll: false,
  maxAgents: 6,
  showSubagents: true,
};

function getConfigDir(): string {
  return path.join(os.homedir(), LAYOUT_FILE_DIR);
}

function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

export function loadConfig(): CliConfig {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...raw };
    }
  } catch {
    // Ignore corrupt config
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: Partial<CliConfig>): void {
  const configDir = getConfigDir();
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const existing = loadConfig();
    const merged = { ...existing, ...config };
    fs.writeFileSync(getConfigPath(), JSON.stringify(merged, null, 2) + '\n');
  } catch {
    // Silently fail — config is non-critical
  }
}

/** Merge CLI args over config file values (CLI takes precedence) */
export function mergeWithArgs(
  config: CliConfig,
  args: { renderer?: string; fps?: number; zoom?: number; watchAll?: boolean },
): CliConfig {
  return {
    ...config,
    renderer: args.renderer && args.renderer !== 'auto' ? args.renderer : config.renderer,
    fps: args.fps || config.fps,
    zoom: args.zoom ?? config.zoom,
    watchAll: args.watchAll ?? config.watchAll,
  };
}
