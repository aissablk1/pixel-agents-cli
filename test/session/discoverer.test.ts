/**
 * Tests for SessionDiscoverer from src/session/discoverer.ts
 * Uses real ~/.claude/projects/ directory for session discovery.
 */

import * as path from 'node:path';
import * as os from 'node:os';
import { SessionDiscoverer } from '../../src/session/discoverer.js';
import { CLAUDE_PROJECTS_DIR, SESSION_ACTIVE_THRESHOLD_MS } from '../../src/constants.js';

const projectsRoot = path.join(os.homedir(), CLAUDE_PROJECTS_DIR);

describe('SessionDiscoverer', () => {
  let discoverer: SessionDiscoverer;

  beforeEach(() => {
    discoverer = new SessionDiscoverer(projectsRoot);
  });

  afterEach(() => {
    discoverer.dispose();
  });

  describe('scan()', () => {
    it('returns sessions from ~/.claude/projects/', () => {
      const sessions = discoverer.scan();

      // The real directory should contain at least some sessions
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThan(0);
    });

    it('each session has the required properties', () => {
      const sessions = discoverer.scan();

      for (const session of sessions) {
        expect(session).toHaveProperty('sessionId');
        expect(session).toHaveProperty('jsonlFile');
        expect(session).toHaveProperty('projectDir');
        expect(session).toHaveProperty('lastModified');
        expect(session).toHaveProperty('isActive');

        expect(typeof session.sessionId).toBe('string');
        expect(typeof session.jsonlFile).toBe('string');
        expect(typeof session.projectDir).toBe('string');
        expect(typeof session.lastModified).toBe('number');
        expect(typeof session.isActive).toBe('boolean');

        // JSONL file path should end with .jsonl
        expect(session.jsonlFile).toMatch(/\.jsonl$/);

        // sessionId should be a non-empty string
        expect(session.sessionId.length).toBeGreaterThan(0);
      }
    });

    it('sessions are sorted by lastModified (most recent first)', () => {
      const sessions = discoverer.scan();

      if (sessions.length < 2) return; // skip if not enough sessions

      for (let i = 1; i < sessions.length; i++) {
        expect(sessions[i - 1].lastModified).toBeGreaterThanOrEqual(sessions[i].lastModified);
      }
    });
  });

  describe('getActiveSessions()', () => {
    it('returns only sessions modified within the active threshold', () => {
      const activeSessions = discoverer.getActiveSessions();
      const now = Date.now();

      for (const session of activeSessions) {
        expect(session.isActive).toBe(true);
        expect(now - session.lastModified).toBeLessThan(SESSION_ACTIVE_THRESHOLD_MS);
      }
    });

    it('returns a subset of all sessions', () => {
      const allSessions = discoverer.scan();
      const activeSessions = discoverer.getActiveSessions();

      expect(activeSessions.length).toBeLessThanOrEqual(allSessions.length);
    });
  });

  describe('dispose()', () => {
    it('cleans up without errors', () => {
      expect(() => {
        discoverer.dispose();
      }).not.toThrow();
    });

    it('can be called multiple times without errors', () => {
      expect(() => {
        discoverer.dispose();
        discoverer.dispose();
      }).not.toThrow();
    });
  });
});
