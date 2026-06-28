import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { createSession, updateSessionStatus, updateSessionGenCptId } from './sessionService.js';
import { appendEvent } from './eventService.js';
import { importSession } from './importService.js';
import { runOpencode, buildGenCptPrompt } from '../runtime/opencodeRunner.js';
import type { RunOpencodeInput, RunOpencodeResult } from '../runtime/opencodeRunner.js';

export type RunGenCptInput = {
  server: string;
  mode: string;
  scope: string[];
  approval: string;
  sourcePath?: string;
  baseline?: string;
  model?: string;
  thinking?: boolean;
  variant?: string;
  agent?: string;
  gencptPath: string;
  opencodeCommand: string;
  sessionRoot: string; // 通常 /tmp
  artifactRoot: string;
};

export type RunnerFn = (input: RunOpencodeInput) => Promise<RunOpencodeResult>;

function listGenCptSessionDirs(root: string): string[] {
  if (!existsSync(root)) return [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.startsWith('gencpt-'))
    .map((name) => join(root, name))
    .filter((path) => {
      try {
        return statSync(path).isDirectory();
      } catch {
        return false;
      }
    });
}

function findNewSessionDir(before: Set<string>, root: string): string | null {
  const current = listGenCptSessionDirs(root);
  const candidates = current.filter((p) => !before.has(p));
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

export function startGenCptAssessment(db: Database.Database, input: RunGenCptInput): { sessionId: string } {
  const session = createSession(db, {
    source: 'started',
    server: input.server,
    mode: input.mode,
    scope: input.scope.join(','),
    approval: input.approval
  });

  updateSessionStatus(db, session.id, 'running');
  appendEvent(db, {
    sessionId: session.id,
    eventType: 'gencpt.run.started',
    payload: { server: input.server, mode: input.mode, scope: input.scope, approval: input.approval }
  });

  return { sessionId: session.id };
}

export async function executeGenCptAssessment(
  db: Database.Database,
  input: RunGenCptInput,
  sessionId: string,
  runnerFn: RunnerFn = runOpencode
): Promise<{ status: string }> {
  const prompt = buildGenCptPrompt({
    server: input.server,
    mode: input.mode,
    scope: input.scope,
    approval: input.approval,
    sourcePath: input.sourcePath,
    baseline: input.baseline
  });

  const before = new Set(listGenCptSessionDirs(input.sessionRoot));

  try {
    const result = await runnerFn({
      command: input.opencodeCommand,
      gencptPath: input.gencptPath,
      prompt,
      model: input.model,
      thinking: input.thinking,
      variant: input.variant,
      agent: input.agent,
      onSessionId: (gencptSessionId) => {
        // Persist the opencode-issued session id next to our internal UUID.
        updateSessionGenCptId(db, sessionId, gencptSessionId);
        appendEvent(db, {
          sessionId,
          eventType: 'opencode.session.detected',
          payload: { gencptSessionId }
        });
      },
      onStdout: (chunk) =>
        appendEvent(db, { sessionId, eventType: 'opencode.stdout', payload: { chunk } }),
      onStderr: (chunk) =>
        appendEvent(db, { sessionId, eventType: 'opencode.stderr', payload: { chunk } })
    });

    const newSessionDir = findNewSessionDir(before, input.sessionRoot);

    if (result.exitCode === 0 && newSessionDir) {
      const importResult = importSession(db, {
        sessionDir: newSessionDir,
        artifactRoot: input.artifactRoot,
        sessionId
      });
      updateSessionStatus(db, sessionId, 'completed');
      appendEvent(db, {
        sessionId,
        eventType: 'assessment.completed',
        payload: {
          exitCode: result.exitCode,
          sessionDir: newSessionDir,
          artifactCount: importResult.artifactCount
        }
      });
      return { status: 'completed' };
    }

    updateSessionStatus(db, sessionId, 'failed');
    appendEvent(db, {
      sessionId,
      eventType: 'assessment.failed',
      payload: {
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        stderr: result.stderr.slice(-500),
        discoveredSessionDir: newSessionDir
      }
    });
    return { status: 'failed' };
  } catch (error) {
    updateSessionStatus(db, sessionId, 'failed');
    appendEvent(db, {
      sessionId,
      eventType: 'assessment.error',
      payload: { error: error instanceof Error ? error.message : String(error) }
    });
    return { status: 'failed' };
  }
}