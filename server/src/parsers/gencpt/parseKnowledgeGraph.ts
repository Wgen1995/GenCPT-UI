import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type GraphNode = {
  id: string;
  nodeType: string;
};

export type ParsedKnowledgeGraph = {
  nodeCount: number;
  edgeCount: number;
  nodeTypes: Record<string, number>;
  edgeTypes: Record<string, number>;
  warnings: string[];
};

function countJsonArrayEntries(filePath: string): unknown[] {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function scanDir(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanDir(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}

function tallyTypes(entries: unknown[], typeKey: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    if (entry && typeof entry === 'object') {
      const t = (entry as Record<string, unknown>)[typeKey];
      const key = typeof t === 'string' ? t : 'unknown';
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

export function parseKnowledgeGraph(sessionDir: string): ParsedKnowledgeGraph {
  const warnings: string[] = [];
  const graphDir = join(sessionDir, 'knowledge_graph');
  const nodesDir = join(graphDir, 'nodes');
  const edgesDir = join(graphDir, 'edges');

  if (!existsSync(graphDir)) {
    warnings.push(`knowledge_graph missing: ${graphDir}`);
    return { nodeCount: 0, edgeCount: 0, nodeTypes: {}, edgeTypes: {}, warnings };
  }

  const nodeFiles = scanDir(nodesDir);
  const edgeFiles = scanDir(edgesDir);

  const nodes: unknown[] = [];
  for (const f of nodeFiles) nodes.push(...countJsonArrayEntries(f));
  const edges: unknown[] = [];
  for (const f of edgeFiles) edges.push(...countJsonArrayEntries(f));

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeTypes: tallyTypes(nodes, 'node_type'),
    edgeTypes: tallyTypes(edges, 'edge_type'),
    warnings
  };
}