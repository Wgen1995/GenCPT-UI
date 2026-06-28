import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseProgress } from './parseProgress.js';
import { parseTaskList } from './parseTaskList.js';
import { parseKnowledgeGraph } from './parseKnowledgeGraph.js';
import { parseFileTree } from './parseFileTree.js';
import { parseReports } from './parseReports.js';

export type ParsedSessionConfig = {
  sessionId: string;
  server: string;
  mode: string;
  scope: string[];
  approval: string;
  suiteVersion?: string;
  envFingerprint?: Record<string, unknown>;
  createdAt?: string;
  raw: Record<string, unknown>;
};

export type SessionSummary = {
  sessionConfig: ParsedSessionConfig | null;
  progress: ReturnType<typeof parseProgress>;
  taskList: ReturnType<typeof parseTaskList>;
  graph: ReturnType<typeof parseKnowledgeGraph>;
  fileTree: ReturnType<typeof parseFileTree>;
  reports: ReturnType<typeof parseReports>['reports'];
  insights: ReturnType<typeof parseReports>['reports'];
  warnings: string[];
};

export function parseSessionConfig(sessionDir: string): { config: ParsedSessionConfig | null; warnings: string[] } {
  const warnings: string[] = [];
  const filePath = join(sessionDir, 'session_config.json');
  if (!existsSync(filePath)) {
    warnings.push(`session_config.json missing: ${filePath}`);
    return { config: null, warnings };
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch (err) {
    warnings.push(`session_config.json parse error: ${(err as Error).message}`);
    return { config: null, warnings };
  }

  const scope = Array.isArray(data.scope)
    ? data.scope.map((s) => String(s))
    : typeof data.scope === 'string'
      ? [data.scope]
      : [];

  const config: ParsedSessionConfig = {
    sessionId: typeof data.session_id === 'string' ? data.session_id : '',
    server: typeof data.server === 'string' ? data.server : '',
    mode: typeof data.mode === 'string' ? data.mode : '',
    scope,
    approval: typeof data.approval === 'string' ? data.approval : '',
    suiteVersion: typeof data.suite_version === 'string' ? data.suite_version : undefined,
    envFingerprint:
      data.env_fingerprint && typeof data.env_fingerprint === 'object'
        ? (data.env_fingerprint as Record<string, unknown>)
        : undefined,
    createdAt: typeof data.created_at === 'string' ? data.created_at : undefined,
    raw: data
  };

  return { config, warnings };
}

export function parseSessionAggregator(sessionDir: string): SessionSummary {
  const warnings: string[] = [];

  const { config: sessionConfig, warnings: cfgWarnings } = parseSessionConfig(sessionDir);
  warnings.push(...cfgWarnings);
  if (!sessionConfig) {
    warnings.push('cannot build session config; aborting aggregation of dependent sections');
  }

  const progress = parseProgress(sessionDir);
  warnings.push(...progress.warnings);

  const taskList = parseTaskList(sessionDir);
  warnings.push(...taskList.warnings);

  const graph = parseKnowledgeGraph(sessionDir);
  warnings.push(...graph.warnings);

  const fileTree = parseFileTree(sessionDir);
  warnings.push(...fileTree.warnings);

  const reportsParsed = parseReports(sessionDir);
  warnings.push(...reportsParsed.warnings);

  // insights is a subset of reports where reportType === 'insights'
  const insights = reportsParsed.reports.filter((r) => r.reportType === 'insights');

  return {
    sessionConfig,
    progress,
    taskList,
    graph,
    fileTree,
    reports: reportsParsed.reports,
    insights,
    warnings
  };
}

export { parseProgress, parseTaskList, parseKnowledgeGraph, parseFileTree, parseReports };