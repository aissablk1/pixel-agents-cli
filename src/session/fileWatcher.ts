/**
 * Polling-based file watcher for JSONL transcript files.
 * Forked from pixel-agents/src/fileWatcher.ts — pure Node.js, no VS Code deps.
 */

import * as fs from 'node:fs';
import type { EventEmitter } from 'node:events';

import { FILE_WATCHER_POLL_INTERVAL_MS, MAX_READ_BYTES } from '../constants.js';
import {
  cancelPermissionTimer,
  cancelWaitingTimer,
} from './timerManager.js';
import { processTranscriptLine } from './transcriptParser.js';
import type { AgentState } from '../types.js';

export function startFileWatching(
  agentId: number,
  agents: Map<number, AgentState>,
  pollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  emitter: EventEmitter,
): void {
  const interval = setInterval(() => {
    if (!agents.has(agentId)) {
      clearInterval(interval);
      return;
    }
    readNewLines(agentId, agents, waitingTimers, permissionTimers, emitter);
  }, FILE_WATCHER_POLL_INTERVAL_MS);
  pollingTimers.set(agentId, interval);
}

export function readNewLines(
  agentId: number,
  agents: Map<number, AgentState>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  emitter: EventEmitter,
): void {
  const agent = agents.get(agentId);
  if (!agent) return;
  try {
    const stat = fs.statSync(agent.jsonlFile);
    if (stat.size <= agent.fileOffset) return;

    const bytesToRead = Math.min(stat.size - agent.fileOffset, MAX_READ_BYTES);
    const buf = Buffer.alloc(bytesToRead);
    const fd = fs.openSync(agent.jsonlFile, 'r');
    fs.readSync(fd, buf, 0, buf.length, agent.fileOffset);
    fs.closeSync(fd);
    agent.fileOffset += bytesToRead;

    const text = agent.lineBuffer + buf.toString('utf-8');
    const lines = text.split('\n');
    agent.lineBuffer = lines.pop() || '';

    const hasLines = lines.some((l) => l.trim());
    if (hasLines) {
      cancelWaitingTimer(agentId, waitingTimers);
      cancelPermissionTimer(agentId, permissionTimers);
      if (agent.permissionSent) {
        agent.permissionSent = false;
        emitter.emit('agentEvent', { type: 'agentToolPermissionClear', id: agentId });
      }
    }

    for (const line of lines) {
      if (!line.trim()) continue;
      processTranscriptLine(agentId, line, agents, waitingTimers, permissionTimers, emitter);
    }
  } catch {
    // File may not exist yet or be temporarily locked
  }
}

export function stopFileWatching(
  agentId: number,
  pollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
): void {
  const pt = pollingTimers.get(agentId);
  if (pt) {
    clearInterval(pt);
    pollingTimers.delete(agentId);
  }
  cancelWaitingTimer(agentId, waitingTimers);
  cancelPermissionTimer(agentId, permissionTimers);
}
