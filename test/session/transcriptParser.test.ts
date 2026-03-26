/**
 * Tests for formatToolStatus and processTranscriptLine
 * from src/session/transcriptParser.ts
 */

import { EventEmitter } from 'node:events';
import { formatToolStatus, processTranscriptLine } from '../../src/session/transcriptParser.js';
import { createAgentState } from '../../src/types.js';
import type { AgentState } from '../../src/types.js';

// ── formatToolStatus ────────────────────────────────────────

describe('formatToolStatus', () => {
  it('returns "Reading <filename>" for Read tool', () => {
    const result = formatToolStatus('Read', { file_path: '/home/user/project/filename.ts' });
    expect(result).toBe('Reading filename.ts');
  });

  it('returns "Editing <filename>" for Edit tool', () => {
    const result = formatToolStatus('Edit', { file_path: '/some/deep/path/component.tsx' });
    expect(result).toBe('Editing component.tsx');
  });

  it('returns "Running: <cmd>" for Bash tool, truncated at 30 chars', () => {
    const shortCmd = 'ls -la';
    expect(formatToolStatus('Bash', { command: shortCmd })).toBe(`Running: ${shortCmd}`);

    const longCmd = 'npm run build && npm run test:integration --verbose';
    const truncated = formatToolStatus('Bash', { command: longCmd });
    // 30 chars of command + "Running: " prefix + ellipsis
    expect(truncated).toBe(`Running: ${longCmd.slice(0, 30)}\u2026`);
    expect(truncated.length).toBe('Running: '.length + 30 + 1);
  });

  it('returns "Searching files" for Glob tool', () => {
    expect(formatToolStatus('Glob', { pattern: '**/*.ts' })).toBe('Searching files');
  });

  it('returns "Searching code" for Grep tool', () => {
    expect(formatToolStatus('Grep', { pattern: 'TODO' })).toBe('Searching code');
  });

  it('returns "Subtask: <desc>" for Agent with description, truncated at 40 chars', () => {
    const shortDesc = 'Analyze the code';
    expect(formatToolStatus('Agent', { description: shortDesc })).toBe(`Subtask: ${shortDesc}`);

    const longDesc = 'Analyze the entire codebase for security vulnerabilities and report findings';
    const truncated = formatToolStatus('Agent', { description: longDesc });
    expect(truncated).toBe(`Subtask: ${longDesc.slice(0, 40)}\u2026`);
  });

  it('returns "Running subtask" for Agent without description', () => {
    expect(formatToolStatus('Agent', {})).toBe('Running subtask');
  });

  it('returns "Running subtask" for Task without description', () => {
    expect(formatToolStatus('Task', {})).toBe('Running subtask');
  });

  it('returns "Using <ToolName>" for unknown tools', () => {
    expect(formatToolStatus('CustomTool', {})).toBe('Using CustomTool');
    expect(formatToolStatus('McpSomething', { arg: 'value' })).toBe('Using McpSomething');
  });
});

// ── processTranscriptLine ───────────────────────────────────

describe('processTranscriptLine', () => {
  let agents: Map<number, AgentState>;
  let waitingTimers: Map<number, ReturnType<typeof setTimeout>>;
  let permissionTimers: Map<number, ReturnType<typeof setTimeout>>;
  let emitter: EventEmitter;

  const AGENT_ID = 1;

  beforeEach(() => {
    agents = new Map();
    const agent = createAgentState(AGENT_ID, 'session-abc', '/project', '/project/session.jsonl');
    agents.set(AGENT_ID, agent);
    waitingTimers = new Map();
    permissionTimers = new Map();
    emitter = new EventEmitter();
  });

  it('sets agent to active and tracks tool IDs on assistant record with tool_use', () => {
    const events: Array<Record<string, unknown>> = [];
    emitter.on('agentEvent', (e: Record<string, unknown>) => events.push(e));

    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'tool_001',
            name: 'Read',
            input: { file_path: '/project/src/index.ts' },
          },
        ],
      },
    });

    processTranscriptLine(AGENT_ID, line, agents, waitingTimers, permissionTimers, emitter);

    const agent = agents.get(AGENT_ID)!;
    expect(agent.activeToolIds.has('tool_001')).toBe(true);
    expect(agent.activeToolStatuses.get('tool_001')).toBe('Reading index.ts');
    expect(agent.activeToolNames.get('tool_001')).toBe('Read');

    // Should have emitted agentStatus active + agentToolStart
    const statusEvent = events.find(
      (e) => e.type === 'agentStatus' && e.status === 'active',
    );
    expect(statusEvent).toBeDefined();

    const toolStartEvent = events.find(
      (e) => e.type === 'agentToolStart' && e.toolId === 'tool_001',
    );
    expect(toolStartEvent).toBeDefined();
  });

  it('clears tool on user record with tool_result', () => {
    // First, set up a tool as active
    const agent = agents.get(AGENT_ID)!;
    agent.activeToolIds.add('tool_002');
    agent.activeToolStatuses.set('tool_002', 'Editing file.ts');
    agent.activeToolNames.set('tool_002', 'Edit');
    agent.hadToolsInTurn = true;

    const line = JSON.stringify({
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_002',
            content: 'File edited successfully',
          },
        ],
      },
    });

    processTranscriptLine(AGENT_ID, line, agents, waitingTimers, permissionTimers, emitter);

    expect(agent.activeToolIds.has('tool_002')).toBe(false);
    expect(agent.activeToolStatuses.has('tool_002')).toBe(false);
    expect(agent.activeToolNames.has('tool_002')).toBe(false);
  });

  it('sets agent to waiting on system turn_duration record', () => {
    const events: Array<Record<string, unknown>> = [];
    emitter.on('agentEvent', (e: Record<string, unknown>) => events.push(e));

    const line = JSON.stringify({
      type: 'system',
      subtype: 'turn_duration',
      duration_ms: 5000,
    });

    processTranscriptLine(AGENT_ID, line, agents, waitingTimers, permissionTimers, emitter);

    const agent = agents.get(AGENT_ID)!;
    expect(agent.isWaiting).toBe(true);
    expect(agent.hadToolsInTurn).toBe(false);

    const waitingEvent = events.find(
      (e) => e.type === 'agentStatus' && e.status === 'waiting',
    );
    expect(waitingEvent).toBeDefined();
  });

  it('does not throw on malformed JSON line', () => {
    expect(() => {
      processTranscriptLine(
        AGENT_ID,
        'this is not valid json {{{',
        agents,
        waitingTimers,
        permissionTimers,
        emitter,
      );
    }).not.toThrow();

    // Agent state should still be updated (lastDataAt, linesProcessed)
    const agent = agents.get(AGENT_ID)!;
    expect(agent.linesProcessed).toBe(1);
  });

  it('does not throw on empty line', () => {
    expect(() => {
      processTranscriptLine(AGENT_ID, '', agents, waitingTimers, permissionTimers, emitter);
    }).not.toThrow();

    const agent = agents.get(AGENT_ID)!;
    expect(agent.linesProcessed).toBe(1);
  });
});
