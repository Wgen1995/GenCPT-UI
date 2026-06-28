import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { applySchema } from '../src/db/schema.js';
import { startGenCptAssessment, executeGenCptAssessment } from '../src/services/runService.js';
import { listEvents } from '../src/services/eventService.js';
import { getSession } from '../src/services/sessionService.js';
import type { RunOpencodeResult } from '../src/runtime/opencodeRunner.js';

type RunnerFn = (input: {
  command: string;
  gencptPath: string;
  prompt: string;
  timeoutMs: number;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}) => Promise<RunOpencodeResult>;

describe('run service', () => {
  let db: Database.Database;
  let tmpSessionRoot: string;
  let tmpArtifact: string;
  let tmpGencpt: string;

  beforeEach(() => {
    db = new Database(':memory:');
    applySchema(db);
    tmpSessionRoot = join(process.cwd(), 'tests/tmp-run-sessions');
    tmpArtifact = join(process.cwd(), 'tests/tmp-run-artifacts');
    tmpGencpt = join(process.cwd(), 'tests/tmp-run-gencpt');
    for (const d of [tmpSessionRoot, tmpArtifact, tmpGencpt]) {
      rmSync(d, { recursive: true, force: true });
      mkdirSync(d, { recursive: true });
    }
  });

  afterEach(() => {
    db.close();
    for (const d of [tmpSessionRoot, tmpArtifact, tmpGencpt]) {
      rmSync(d, { recursive: true, force: true });
    }
  });

  function makeFakeSessionDir(name: string) {
    const dir = join(tmpSessionRoot, name);
    makeFakeSessionDirAt(dir);
    return dir;
  }

  function makeFakeSessionDirAt(dir: string) {
    mkdirSync(join(dir, 'reports'), { recursive: true });
    mkdirSync(join(dir, 'knowledge_graph', 'nodes'), { recursive: true });
    mkdirSync(join(dir, 'knowledge_graph', 'edges'), { recursive: true });
    writeFileSync(
      join(dir, 'session_config.json'),
      JSON.stringify({
        session_id: 'gencpt-test-001',
        server: 'prod-k8s-01',
        mode: 'fast',
        scope: ['k8s'],
        approval: 'standard',
        suite_version: 'V1.1',
        env_fingerprint: { os_type: 'linux' },
        created_at: '2026-06-27T00:00:00Z'
      })
    );
    writeFileSync(
      join(dir, 'progress.json'),
      JSON.stringify({
        phases: { '1a': { status: 'complete' }, '8c': { status: 'complete' } },
        current_phase: '8c',
        last_updated: '2026-06-27T01:00:00Z'
      })
    );
    writeFileSync(join(dir, 'reports', 'pentest_report.md'), '# Report\n\ntext\n');
    writeFileSync(join(dir, 'knowledge_graph', 'nodes', 'pods.json'), JSON.stringify([{ id: 'p1', node_type: 'pod', data: { name: 'api' } }]));
    writeFileSync(join(dir, 'knowledge_graph', 'edges', 'infra.json'), '[]');
    return dir;
  }

  it('creates session, records stdout, completes on success', async () => {
    const fakeSessionDir = join(tmpSessionRoot, 'gencpt-real-001');

    // Runner simulates GenCPT creating its session dir DURING execution
    const successRunner: RunnerFn = async (input) => {
      input.onStdout?.('phase 1a complete\n');
      input.onStdout?.('phase 8c complete\n');
      // Simulate GenCPT writing its session directory after the before snapshot
      makeFakeSessionDirAt(fakeSessionDir);
      return { exitCode: 0, stdout: 'ok', stderr: '', timedOut: false };
    };

    const { sessionId } = startGenCptAssessment(db, {
      server: 'prod-k8s-01',
      mode: 'fast',
      scope: ['k8s'],
      approval: 'standard',
      gencptPath: tmpGencpt,
      opencodeCommand: 'echo',
      timeoutMs: 5000,
      sessionRoot: tmpSessionRoot,
      artifactRoot: tmpArtifact
    });

    const result = await executeGenCptAssessment(
      db,
      {
        server: 'prod-k8s-01',
        mode: 'fast',
        scope: ['k8s'],
        approval: 'standard',
        gencptPath: tmpGencpt,
        opencodeCommand: 'echo',
        timeoutMs: 5000,
        sessionRoot: tmpSessionRoot,
        artifactRoot: tmpArtifact
      },
      sessionId,
      successRunner
    );

    expect(result.status).toBe('completed');
    const session = getSession(db, sessionId);
    expect(session?.status).toBe('completed');
    expect(session?.source).toBe('started');

    const events = listEvents(db, sessionId);
    expect(events.some((e) => e.eventType === 'gencpt.run.started')).toBe(true);
    expect(events.some((e) => e.eventType === 'opencode.stdout')).toBe(true);
    expect(events.some((e) => e.eventType === 'assessment.completed')).toBe(true);
    // After import, ingest event should also be recorded
    expect(events.some((e) => e.eventType === 'gencpt.session.ingested')).toBe(true);

    // fakeSessionDir variable to ensure it exists for finder
    expect(fakeSessionDir.length).toBeGreaterThan(0);
  });

  it('marks failed on non-zero exit', async () => {
    const failingRunner: RunnerFn = async (input) => {
      input.onStderr?.('SSH connection failed\n');
      return { exitCode: 1, stdout: '', stderr: 'SSH connection failed', timedOut: false };
    };

    const { sessionId } = startGenCptAssessment(db, {
      server: 'srv',
      mode: 'fast',
      scope: ['k8s'],
      approval: 'standard',
      gencptPath: tmpGencpt,
      opencodeCommand: 'echo',
      timeoutMs: 5000,
      sessionRoot: tmpSessionRoot,
      artifactRoot: tmpArtifact
    });

    const result = await executeGenCptAssessment(
      db,
      {
        server: 'srv',
        mode: 'fast',
        scope: ['k8s'],
        approval: 'standard',
        gencptPath: tmpGencpt,
        opencodeCommand: 'echo',
        timeoutMs: 5000,
        sessionRoot: tmpSessionRoot,
        artifactRoot: tmpArtifact
      },
      sessionId,
      failingRunner
    );

    expect(result.status).toBe('failed');
    const session = getSession(db, sessionId);
    expect(session?.status).toBe('failed');

    const events = listEvents(db, sessionId);
    expect(events.some((e) => e.eventType === 'opencode.stderr')).toBe(true);
    expect(events.some((e) => e.eventType === 'assessment.failed')).toBe(true);
  });

  it('marks failed on runner timeout', async () => {
    const timeoutRunner: RunnerFn = async () => ({
      exitCode: null,
      stdout: '',
      stderr: '',
      timedOut: true
    });

    const { sessionId } = startGenCptAssessment(db, {
      server: 'srv',
      mode: 'full',
      scope: ['k8s', 'docker'],
      approval: 'express',
      gencptPath: tmpGencpt,
      opencodeCommand: 'echo',
      timeoutMs: 1000,
      sessionRoot: tmpSessionRoot,
      artifactRoot: tmpArtifact
    });

    const result = await executeGenCptAssessment(
      db,
      {
        server: 'srv',
        mode: 'full',
        scope: ['k8s', 'docker'],
        approval: 'express',
        gencptPath: tmpGencpt,
        opencodeCommand: 'echo',
        timeoutMs: 1000,
        sessionRoot: tmpSessionRoot,
        artifactRoot: tmpArtifact
      },
      sessionId,
      timeoutRunner
    );

    expect(result.status).toBe('failed');
    const events = listEvents(db, sessionId);
    expect(events.some((e) => e.eventType === 'assessment.failed')).toBe(true);
    const failEvent = events.find((e) => e.eventType === 'assessment.failed');
    expect(failEvent?.payload?.timedOut).toBe(true);
  });
});