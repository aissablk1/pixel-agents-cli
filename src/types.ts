/**
 * Core types for pixel-agents-cli.
 * Forked from pixel-agents/src/types.ts — removed vscode.Terminal dependency.
 */

export interface AgentState {
  id: number;
  sessionId: string;
  projectDir: string;
  jsonlFile: string;
  fileOffset: number;
  lineBuffer: string;
  activeToolIds: Set<string>;
  activeToolStatuses: Map<string, string>;
  activeToolNames: Map<string, string>;
  activeSubagentToolIds: Map<string, Set<string>>;
  activeSubagentToolNames: Map<string, Map<string, string>>;
  backgroundAgentToolIds: Set<string>;
  isWaiting: boolean;
  permissionSent: boolean;
  hadToolsInTurn: boolean;
  folderName?: string;
  lastDataAt: number;
  linesProcessed: number;
  seenUnknownRecordTypes: Set<string>;
}

export interface PersistedAgent {
  id: number;
  sessionId: string;
  jsonlFile: string;
  projectDir: string;
  folderName?: string;
}

export interface DiscoveredSession {
  sessionId: string;
  jsonlFile: string;
  projectDir: string;
  projectPath: string;
  lastModified: number;
  fileSize: number;
  firstPrompt?: string;
  gitBranch?: string;
  isActive: boolean;
}

/** Events emitted instead of VS Code's postMessage */
export type AgentEvent =
  | { type: 'agentCreated'; id: number; projectDir: string }
  | { type: 'agentClosed'; id: number }
  | { type: 'agentStatus'; id: number; status: 'active' | 'waiting' }
  | { type: 'agentToolStart'; id: number; toolId: string; status: string }
  | { type: 'agentToolDone'; id: number; toolId: string }
  | { type: 'agentToolsClear'; id: number }
  | { type: 'agentToolPermission'; id: number }
  | { type: 'agentToolPermissionClear'; id: number }
  | { type: 'subagentToolStart'; id: number; parentToolId: string; toolId: string; status: string }
  | { type: 'subagentToolDone'; id: number; parentToolId: string; toolId: string }
  | { type: 'subagentClear'; id: number; parentToolId: string }
  | { type: 'subagentToolPermission'; id: number; parentToolId: string };

export function createAgentState(
  id: number,
  sessionId: string,
  projectDir: string,
  jsonlFile: string,
  fileOffset = 0,
): AgentState {
  return {
    id,
    sessionId,
    projectDir,
    jsonlFile,
    fileOffset,
    lineBuffer: '',
    activeToolIds: new Set(),
    activeToolStatuses: new Map(),
    activeToolNames: new Map(),
    activeSubagentToolIds: new Map(),
    activeSubagentToolNames: new Map(),
    backgroundAgentToolIds: new Set(),
    isWaiting: false,
    permissionSent: false,
    hadToolsInTurn: false,
    lastDataAt: 0,
    linesProcessed: 0,
    seenUnknownRecordTypes: new Set(),
  };
}
