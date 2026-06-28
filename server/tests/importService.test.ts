import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { applySchema } from '../src/db/schema.js';
import { importSession } from '../src/services/importService.js';
import { createSessionsRoute } from '../src/routes/sessions.js';

describe('import session', () => {
  let db: Database.Database;
  let tmpSession: string;
  let tmpArtifact: string;

  beforeEach(() => {
    db = new Database(':memory:');
    applySchema(db);
    tmpSession = join(process.cwd(), 'tests/tmp-session');
    tmpArtifact = join(process.cwd(), 'tests/tmp-artifacts');
    rmSync(tmpSession, { recursive: true, force: true });
    rmSync(tmpArtifact, { recursive: true, force: true });
    mkdirSync(tmpSession, { recursive: true });
    mkdirSync(tmpArtifact, { recursive: true });

    writeFileSync(join(tmpSession, 'session_config.json'), JSON.stringify({
      session_id: 'sess-test-001',
      server: 'prod-k8s-01',
      mode: 'full',
      scope: ['k8s'],
      approval: 'standard',
      suite_version: 'V1.1',
      env_fingerprint: { os_type: 'linux' },
      created_at: '2026-06-27T00:00:00Z'
    }));

    writeFileSync(join(tmpSession, 'progress.json'), JSON.stringify({
      phases: { '1a': { status: 'complete' }, '8c': { status: 'complete' } },
      current_phase: '8c',
      last_updated: '2026-06-27T01:00:00Z'
    }));

    mkdirSync(join(tmpSession, 'knowledge_graph', 'nodes'), { recursive: true });
    writeFileSync(join(tmpSession, 'knowledge_graph', 'nodes', 'pods.json'), JSON.stringify([
      { id: 'pod-1', node_type: 'pod', data: { name: 'payment-api' } }
    ]));
    mkdirSync(join(tmpSession, 'knowledge_graph', 'edges'), { recursive: true });
    writeFileSync(join(tmpSession, 'knowledge_graph', 'edges', 'infra.json'), '[]');

    mkdirSync(join(tmpSession, 'reports'), { recursive: true });
    writeFileSync(join(tmpSession, 'reports', 'pentest_report.md'), '# Pentest Report\n\nTest report.\n');
    writeFileSync(join(tmpSession, 'reports', 'pentest_report.json'), JSON.stringify({ status: 'complete' }));
  });

  afterEach(() => {
    db.close();
    rmSync(tmpSession, { recursive: true, force: true });
    rmSync(tmpArtifact, { recursive: true, force: true });
  });

  it('imports a GenCPT session directory', () => {
    const result = importSession(db, { sessionDir: tmpSession, artifactRoot: tmpArtifact });

    expect(result.sessionId).toBeTruthy();
    expect(result.artifactCount).toBeGreaterThan(0);
    expect(result.summary.progress.currentPhase).toBe('8c');
    expect(result.summary.graph.nodeCount).toBeGreaterThan(0);
    expect(result.summary.reports.length).toBeGreaterThan(0);
    expect(result.summary.warnings).toBeDefined();
  });

  it('handles missing files gracefully', () => {
    // Remove task_list.json - should generate warning not crash
    rmSync(join(tmpSession, 'task_list.json'), { force: true });
    const result = importSession(db, { sessionDir: tmpSession, artifactRoot: tmpArtifact });
    expect(result.summary.warnings.some(w => w.includes('task_list'))).toBe(true);
  });

  it('parses insights from evidence/insights.md compat path', () => {
    mkdirSync(join(tmpSession, 'evidence'), { recursive: true });
    writeFileSync(join(tmpSession, 'evidence', 'insights.md'), '# Insights\n\ntext\n');
    mkdirSync(join(tmpSession, 'evidence', 'attack'), { recursive: true });
    // Also add the attack variant to verify both get picked up once each
    writeFileSync(join(tmpSession, 'evidence', 'attack', 'insights.md'), '# Attack Insights\n\ntext\n');
    const result = importSession(db, { sessionDir: tmpSession, artifactRoot: tmpArtifact });
    expect(result.summary.insights.length).toBe(2);
    expect(result.summary.insights.map((r) => r.reportType)).toEqual(['insights', 'insights']);
    expect(result.summary.reports.some((r) => r.reportType === 'insights')).toBe(true);
  });

  it('recursively scans reports subdirectories', () => {
    mkdirSync(join(tmpSession, 'reports', 'poc_package'), { recursive: true });
    writeFileSync(join(tmpSession, 'reports', 'poc_package', 'poc.sh'), '#!/bin/sh\necho ok\n');
    // .sh is not parsed as report, only .md/.json
    writeFileSync(join(tmpSession, 'reports', 'poc_package', 'notes.json'), JSON.stringify({ note: 'poc' }));
    const result = importSession(db, { sessionDir: tmpSession, artifactRoot: tmpArtifact });
    expect(result.summary.reports.some((r) => r.relativePath === 'reports/poc_package/notes.json')).toBe(true);
  });

  describe('POST /sessions/import', () => {
    it('imports a session via the HTTP route', async () => {
      const app = createSessionsRoute(db, tmpArtifact);
      const res = await app.request('/sessions/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionDir: tmpSession })
      });
      expect(res.status).toBe(201);
      const json = (await res.json()) as { sessionId: string; artifactCount: number };
      expect(json.sessionId).toBeTruthy();
      expect(json.artifactCount).toBeGreaterThan(0);
    });

    it('returns 400 when sessionDir is empty', async () => {
      const app = createSessionsRoute(db, tmpArtifact);
      const res = await app.request('/sessions/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionDir: '' })
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 when session directory does not exist', async () => {
      const app = createSessionsRoute(db, tmpArtifact);
      const res = await app.request('/sessions/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionDir: '/definitely/not/a/real/path/xyz-123' })
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 when body is missing sessionDir', async () => {
      const app = createSessionsRoute(db, tmpArtifact);
      const res = await app.request('/sessions/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      });
      expect(res.status).toBe(400);
    });
  });

  it('records a warning and marks session failed when copyDirectory cannot write to target', () => {
    // Point artifactRoot at a path that cannot be created: an existing file,
    // so copyDirectory's target dir creation fails.
    const blockerFile = join(process.cwd(), 'tests/tmp-blocker-file');
    rmSync(blockerFile, { force: true });
    writeFileSync(blockerFile, 'blocker');
    try {
      const result = importSession(db, {
        sessionDir: tmpSession,
        // artifactRoot placed inside a non-directory file to force mkdir failure
        artifactRoot: join(blockerFile, 'nested')
      });
      expect(result.artifactCount).toBe(0);
      expect(result.summary.warnings.some((w) => w.includes('failed to copy session directory'))).toBe(true);
    } finally {
      rmSync(blockerFile, { force: true });
    }
  });
});