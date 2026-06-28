import type Database from 'better-sqlite3';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { join, basename, relative, sep } from 'node:path';
import { createSession, updateSessionStatus, updateSessionSummary, getSession } from './sessionService.js';
import { appendEvent } from './eventService.js';
import { copyDirectory, indexArtifact, computeSha256 } from './artifactService.js';
import { parseSessionAggregator } from '../parsers/gencpt/parseSession.js';

export type ImportSessionInput = {
  sessionDir: string;
  artifactRoot: string;
  /**
   * Optional existing session id to reuse (e.g. a `started` session created by
   * the run pipeline). When omitted a new `imported` session is created.
   */
  sessionId?: string;
};

export type ImportSessionResult = {
  sessionId: string;
  artifactCount: number;
  archivedDir: string;
  summary: ReturnType<typeof parseSessionAggregator>;
};

function detectArtifactType(relPath: string): string {
  const parts = relPath.split(sep);
  if (parts[0] === 'knowledge_graph') return 'gencpt.knowledge_graph';
  if (parts[0] === 'reports') return 'gencpt.report';
  if (relPath === 'session_config.json') return 'gencpt.session_config';
  if (relPath === 'progress.json') return 'gencpt.progress';
  if (relPath === 'task_list.json') return 'gencpt.task_list';
  return 'gencpt.file';
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function indexTree(db: Database.Database, sessionId: string, root: string): number {
  let count = 0;
  const entries = walkFiles(root);
  for (const abs of entries) {
    const rel = relative(root, abs);
    let size = 0;
    try {
      size = statSync(abs).size;
    } catch {
      size = 0;
    }
    let sha: string | undefined;
    try {
      sha = computeSha256(abs);
    } catch {
      sha = undefined;
    }
    indexArtifact(db, {
      sessionId,
      relativePath: rel,
      absolutePath: abs,
      artifactType: detectArtifactType(rel),
      size,
      sha256: sha
    });
    count++;
  }
  return count;
}

export function importSession(db: Database.Database, input: ImportSessionInput): ImportSessionResult {
  const { sessionDir, artifactRoot } = input;
  if (!existsSync(sessionDir)) {
    throw new Error(`session directory not found: ${sessionDir}`);
  }
  if (!statSync(sessionDir).isDirectory()) {
    throw new Error(`session path is not a directory: ${sessionDir}`);
  }

  const summary = parseSessionAggregator(sessionDir);
  const sessionConfig = summary.sessionConfig;

  let sessionId: string;
  if (input.sessionId && getSession(db, input.sessionId)) {
    sessionId = input.sessionId;
    // Backfill any missing fields from the parsed session_config.json
    const existing = getSession(db, sessionId)!;
    const updates: Record<string, unknown> = {};
    if (!existing.gencptSessionId && sessionConfig?.sessionId) {
      updates.gencpt_session_id = sessionConfig.sessionId;
    }
    if (!existing.server && sessionConfig?.server) {
      updates.server = sessionConfig.server;
    }
    if (!existing.mode && sessionConfig?.mode) {
      updates.mode = sessionConfig.mode;
    }
    if (!existing.scope && sessionConfig?.scope?.length) {
      updates.scope = sessionConfig.scope.join(',');
    }
    if (!existing.approval && sessionConfig?.approval) {
      updates.approval = sessionConfig.approval;
    }
    if (Object.keys(updates).length > 0) {
      const cols = Object.keys(updates)
        .map((k) => `${k} = ?`)
        .join(', ');
      const now = new Date().toISOString();
      db.prepare(`UPDATE sessions SET ${cols}, updated_at = ? WHERE id = ?`).run(
        ...Object.values(updates),
        now,
        sessionId
      );
    }
    // Fill original_dir (if previously null) for traceability
    if (!existing.originalDir) {
      db.prepare('UPDATE sessions SET original_dir = ? WHERE id = ?').run(sessionDir, sessionId);
    }
    updateSessionSummary(db, sessionId, summary as unknown as Record<string, unknown>);
  } else {
    const session = createSession(db, {
      source: 'imported',
      server: sessionConfig?.server ?? undefined,
      mode: sessionConfig?.mode ?? undefined,
      scope: sessionConfig?.scope?.join(',') ?? undefined,
      approval: sessionConfig?.approval ?? undefined,
      gencptSessionId: sessionConfig?.sessionId || undefined,
      originalDir: sessionDir
    });
    sessionId = session.id;
  }
  const sessionBase = basename(sessionDir);
  const archivedDir = join(artifactRoot, sessionId, 'raw_session', sessionBase);

  try {
    copyDirectory(sessionDir, archivedDir);
  } catch (err) {
    summary.warnings.push(`failed to copy session directory: ${(err as Error).message}`);
    updateSessionStatus(db, sessionId, 'failed');
    appendEvent(db, {
      sessionId,
      eventType: 'gencpt.session.ingest_failed',
      payload: { error: (err as Error).message, sessionDir, archivedDir }
    });
    updateSessionSummary(db, sessionId, summary as unknown as Record<string, unknown>);
    return { sessionId, artifactCount: 0, archivedDir, summary };
  }

  const artifactCount = indexTree(db, sessionId, archivedDir);

  updateSessionSummary(db, sessionId, summary as unknown as Record<string, unknown>);
  updateSessionStatus(db, sessionId, 'completed');
  appendEvent(db, {
    sessionId,
    eventType: 'gencpt.session.ingested',
    payload: {
      gencptSessionId: sessionConfig?.sessionId ?? null,
      server: sessionConfig?.server ?? null,
      mode: sessionConfig?.mode ?? null,
      artifactCount,
      archivedDir,
      warnings: summary.warnings
    }
  });

  return { sessionId, artifactCount, archivedDir, summary };
}