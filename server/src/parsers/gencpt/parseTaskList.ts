import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export type PhaseTask = {
  id: string;
  status?: string;
  description?: string;
};

export type ParsedTaskList = {
  phases: PhaseTask[];
  taskCount: number;
  warnings: string[];
};

type RawTaskList = {
  phases?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
} & Record<string, unknown>;

export function parseTaskList(sessionDir: string): ParsedTaskList {
  const warnings: string[] = [];
  const filePath = join(sessionDir, 'task_list.json');
  if (!existsSync(filePath)) {
    warnings.push(`task_list.json missing: ${filePath}`);
    return { phases: [], taskCount: 0, warnings };
  }

  let data: RawTaskList;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8')) as RawTaskList;
  } catch (err) {
    warnings.push(`task_list.json parse error: ${(err as Error).message}`);
    return { phases: [], taskCount: 0, warnings };
  }

  const rawPhases = Array.isArray(data.phases) ? data.phases : Array.isArray(data.tasks) ? data.tasks : [];
  const phases: PhaseTask[] = rawPhases.map((p) => ({
    id: String(p.id ?? p.phase ?? p.name ?? ''),
    status: typeof p.status === 'string' ? p.status : undefined,
    description: typeof p.description === 'string' ? p.description : undefined
  }));

  return {
    phases,
    taskCount: phases.length,
    warnings
  };
}