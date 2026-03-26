/**
 * Session discovery for Claude Code CLI.
 * Scans ~/.claude/projects/ to find active JSONL session files.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';

import {
  CLAUDE_PROJECTS_DIR,
  SESSION_ACTIVE_THRESHOLD_MS,
  SESSION_SCAN_INTERVAL_MS,
} from '../constants.js';
import { createAgentState } from '../types.js';
import type { AgentState, AgentEvent, DiscoveredSession } from '../types.js';
import { startFileWatching, stopFileWatching } from './fileWatcher.js';

export class SessionDiscoverer extends EventEmitter {
  private readonly projectsRoot: string;
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private nextAgentId = 0;

  readonly agents = new Map<number, AgentState>();
  private readonly pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
  private readonly waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly watchedFiles = new Set<string>();

  constructor(projectsRoot?: string) {
    super();
    this.projectsRoot = projectsRoot || path.join(os.homedir(), CLAUDE_PROJECTS_DIR);
  }

  /** Scan all project directories for JSONL session files */
  scan(): DiscoveredSession[] {
    const sessions: DiscoveredSession[] = [];

    if (!fs.existsSync(this.projectsRoot)) return sessions;

    let projectDirs: string[];
    try {
      projectDirs = fs.readdirSync(this.projectsRoot);
    } catch {
      return sessions;
    }

    for (const dir of projectDirs) {
      const fullDir = path.join(this.projectsRoot, dir);
      let dirStat: fs.Stats;
      try {
        dirStat = fs.statSync(fullDir);
      } catch {
        continue;
      }
      if (!dirStat.isDirectory()) continue;

      // Try to read sessions-index.json for metadata
      let sessionIndex: Record<string, unknown> | null = null;
      const indexPath = path.join(fullDir, 'sessions-index.json');
      try {
        if (fs.existsSync(indexPath)) {
          sessionIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        }
      } catch {
        // Ignore corrupt index
      }

      // Find JSONL files in this project directory
      let files: string[];
      try {
        files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.jsonl'));
      } catch {
        continue;
      }

      for (const file of files) {
        const fullPath = path.join(fullDir, file);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue;
        }

        const sessionId = path.basename(file, '.jsonl');
        const now = Date.now();
        const isActive = now - stat.mtimeMs < SESSION_ACTIVE_THRESHOLD_MS;

        // Try to extract metadata from sessions-index
        let firstPrompt: string | undefined;
        let gitBranch: string | undefined;
        let projectPath: string | undefined;
        if (sessionIndex) {
          const entries = (sessionIndex as Record<string, unknown>)[sessionId] as
            | Record<string, unknown>
            | undefined;
          if (entries) {
            firstPrompt = entries.firstPrompt as string | undefined;
            gitBranch = entries.gitBranch as string | undefined;
            projectPath = entries.projectPath as string | undefined;
          }
        }

        sessions.push({
          sessionId,
          jsonlFile: fullPath,
          projectDir: fullDir,
          projectPath: projectPath || this.reverseHashDir(dir),
          lastModified: stat.mtimeMs,
          fileSize: stat.size,
          firstPrompt,
          gitBranch,
          isActive,
        });
      }
    }

    return sessions.sort((a, b) => b.lastModified - a.lastModified);
  }

  /** Get only currently active sessions */
  getActiveSessions(): DiscoveredSession[] {
    return this.scan().filter((s) => s.isActive);
  }

  /** Start watching specific sessions, creating agents for each */
  watchSessions(sessions: DiscoveredSession[]): void {
    for (const session of sessions) {
      if (this.watchedFiles.has(session.jsonlFile)) continue;

      const id = this.nextAgentId++;
      const fileSize = session.fileSize;

      // Start from current end of file to only see new activity
      const agent = createAgentState(
        id,
        session.sessionId,
        session.projectDir,
        session.jsonlFile,
        fileSize,
      );
      this.agents.set(id, agent);
      this.watchedFiles.add(session.jsonlFile);

      this.emit('agentEvent', {
        type: 'agentCreated',
        id,
        projectDir: session.projectDir,
      } satisfies AgentEvent);

      startFileWatching(
        id,
        this.agents,
        this.pollingTimers,
        this.waitingTimers,
        this.permissionTimers,
        this,
      );
    }
  }

  /** Start periodic scanning for new sessions */
  startPeriodicScan(intervalMs = SESSION_SCAN_INTERVAL_MS): void {
    if (this.scanTimer) return;
    this.scanTimer = setInterval(() => {
      const active = this.getActiveSessions();
      // Auto-watch newly discovered active sessions
      const unwatched = active.filter((s) => !this.watchedFiles.has(s.jsonlFile));
      if (unwatched.length > 0) {
        this.watchSessions(unwatched);
      }

      // Check for stale agents (file not modified for a long time)
      for (const [id, agent] of this.agents) {
        try {
          const stat = fs.statSync(agent.jsonlFile);
          if (Date.now() - stat.mtimeMs > SESSION_ACTIVE_THRESHOLD_MS * 10) {
            this.removeAgent(id);
          }
        } catch {
          this.removeAgent(id);
        }
      }
    }, intervalMs);
  }

  /** Stop periodic scanning */
  stopPeriodicScan(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }

  /** Remove an agent and stop watching its file */
  private removeAgent(id: number): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    stopFileWatching(id, this.pollingTimers, this.waitingTimers, this.permissionTimers);
    this.watchedFiles.delete(agent.jsonlFile);
    this.agents.delete(id);
    this.emit('agentEvent', { type: 'agentClosed', id } satisfies AgentEvent);
  }

  /** Clean up all resources */
  dispose(): void {
    this.stopPeriodicScan();
    for (const id of [...this.agents.keys()]) {
      this.removeAgent(id);
    }
  }

  /** Best-effort reverse of the directory hash to a readable path */
  private reverseHashDir(hashedDir: string): string {
    // Claude Code replaces path separators with '-'
    // e.g., "-Users-john-myproject" -> "/Users/john/myproject"
    if (hashedDir.startsWith('-')) {
      return hashedDir.replace(/-/g, '/');
    }
    return hashedDir;
  }
}
