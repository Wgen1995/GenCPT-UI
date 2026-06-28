import type Database from 'better-sqlite3';
import { Hono } from 'hono';
import { z } from 'zod';
import { startGenCptAssessment, executeGenCptAssessment } from '../services/runService.js';

const RunSchema = z.object({
  server: z.string().min(1),
  mode: z.enum(['fast', 'full', 'custom']),
  scope: z.array(z.string()),
  approval: z.enum(['standard', 'express', 'manual']),
  sourcePath: z.string().optional(),
  baseline: z.string().optional(),
  model: z.string().optional(),
  thinking: z.boolean().optional(),
  variant: z.string().optional(),
  agent: z.string().optional()
});

export type RunRouteConfig = {
  gencptPath: string;
  opencodeCommand: string;
  sessionRoot: string;
  artifactRoot: string;
};

export function createRunRoute(db: Database.Database, runConfig: RunRouteConfig): Hono {
  const route = new Hono();

  route.post('/sessions/run', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = RunSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
    }

    const runInput = {
      server: parsed.data.server,
      mode: parsed.data.mode,
      scope: parsed.data.scope,
      approval: parsed.data.approval,
      sourcePath: parsed.data.sourcePath,
      baseline: parsed.data.baseline,
      model: parsed.data.model,
      thinking: parsed.data.thinking,
      variant: parsed.data.variant,
      agent: parsed.data.agent,
      gencptPath: runConfig.gencptPath,
      opencodeCommand: runConfig.opencodeCommand,
      sessionRoot: runConfig.sessionRoot,
      artifactRoot: runConfig.artifactRoot
    };

    const { sessionId } = startGenCptAssessment(db, runInput);

    void executeGenCptAssessment(db, runInput, sessionId);

    return c.json(
      {
        sessionId,
        status: 'running',
        streamUrl: `/api/sessions/${sessionId}/events/stream`
      },
      202
    );
  });

  return route;
}