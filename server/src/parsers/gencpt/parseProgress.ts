import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export type PhaseInfo = {
  id: string;
  status: string;
};

export type ParsedProgress = {
  currentPhase: string;
  phaseCount: number;
  phases: PhaseInfo[];
  lastUpdated: string | null;
  warnings: string[];
};

type RawPhase = { status?: string } & Record<string, unknown>;

function toPhaseList(raw: Record<string, unknown> | undefined): PhaseInfo[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: PhaseInfo[] = [];
  for (const [id, val] of Object.entries(raw)) {
    if (val && typeof val === 'object') {
      const status = (val as RawPhase).status ?? 'unknown';
      out.push({ id, status: String(status) });
    }
  }
  return out;
}

export function parseProgress(sessionDir: string): ParsedProgress {
  const warnings: string[] = [];
  const filePath = join(sessionDir, 'progress.json');
  if (!existsSync(filePath)) {
    warnings.push(`progress.json missing: ${filePath}`);
    return { currentPhase: '', phaseCount: 0, phases: [], lastUpdated: null, warnings };
  }

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch (err) {
    warnings.push(`progress.json parse error: ${(err as Error).message}`);
    return { currentPhase: '', phaseCount: 0, phases: [], lastUpdated: null, warnings };
  }

  const phasesRaw = data.phases as Record<string, unknown> | undefined;
  const phases = toPhaseList(phasesRaw);
  const rawCurrent = data.current_phase ?? data.currentPhase;
  const currentPhase = typeof rawCurrent === 'string' ? rawCurrent : '';
  const lastUpdated = typeof data.last_updated === 'string' ? data.last_updated : null;

  return {
    currentPhase,
    phaseCount: phases.length,
    phases,
    lastUpdated,
    warnings
  };
}