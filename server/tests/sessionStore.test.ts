import Database from 'better-sqlite3';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { applySchema } from '../src/db/schema.js';
import { createSession, getSession, listSessions, updateSessionStatus } from '../src/services/sessionService.js';
import { appendEvent, listEvents } from '../src/services/eventService.js';
import { indexArtifact, listArtifacts, getArtifactContent } from '../src/services/artifactService.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

describe('session store', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    db = new Database(':memory:');
    applySchema(db);
    tmpDir = join(process.cwd(), 'tests/tmp-store-test');
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates and retrieves a session', () => {
    const session = createSession(db, { source: 'imported', server: 'prod-k8s-01', mode: 'full', scope: 'k8s', approval: 'standard' });
    expect(session.id).toBeTruthy();
    expect(session.status).toBe('created');
    expect(session.server).toBe('prod-k8s-01');

    const found = getSession(db, session.id);
    expect(found?.server).toBe('prod-k8s-01');
  });

  it('lists sessions and updates status', () => {
    const s1 = createSession(db, { source: 'imported', server: 'srv1', mode: 'fast', scope: 'k8s', approval: 'standard' });
    const s2 = createSession(db, { source: 'started', server: 'srv2', mode: 'full', scope: 'docker', approval: 'manual' });
    const list = listSessions(db);
    expect(list.length).toBe(2);

    updateSessionStatus(db, s1.id, 'completed');
    const updated = getSession(db, s1.id);
    expect(updated?.status).toBe('completed');
  });

  it('appends and lists events', () => {
    const session = createSession(db, { source: 'imported', server: 'srv', mode: 'fast', scope: 'k8s', approval: 'standard' });
    appendEvent(db, { sessionId: session.id, eventType: 'opencode.stdout', payload: { chunk: 'hello' } });
    appendEvent(db, { sessionId: session.id, eventType: 'phase.completed', payload: { phase: '1a' } });
    const events = listEvents(db, session.id);
    expect(events.length).toBe(2);
    expect(events[0].eventType).toBe('opencode.stdout');
    expect(events[1].eventType).toBe('phase.completed');
  });

  it('indexes artifacts and reads content', () => {
    const session = createSession(db, { source: 'imported', server: 'srv', mode: 'fast', scope: 'k8s', approval: 'standard' });
    const filePath = join(tmpDir, 'test.txt');
    writeFileSync(filePath, 'test content');
    indexArtifact(db, { sessionId: session.id, relativePath: 'test.txt', absolutePath: filePath, artifactType: 'gencpt.report', size: 12, sha256: 'abc123' });
    const artifacts = listArtifacts(db, session.id);
    expect(artifacts.length).toBe(1);
    expect(artifacts[0].relativePath).toBe('test.txt');

    const content = getArtifactContent(filePath);
    expect(content).toBe('test content');
  });
});