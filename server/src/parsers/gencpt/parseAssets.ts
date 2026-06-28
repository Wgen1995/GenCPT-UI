import { readFileSync } from 'node:fs';
import matter from 'gray-matter';

export type ParsedSkillFrontmatter = {
  name: string;
  description: string;
  raw: Record<string, unknown>;
  content: string;
};

export type ParsedMust = {
  mustInputs: string[];
  mustOutputs: string[];
};

export type ParsedAttackFrontmatter = {
  source: string;
  confidence: string;
  platforms: string[];
  requiredTools: string[];
  executionContexts: string[];
  maxVerificationLevel: string;
  destructive: boolean;
  mappedAttackSurfaces: string[];
  mappedComplianceFamilies: string[];
};

const READ_OPTS = { encoding: 'utf-8' } as const;

export function parseSkillFrontmatter(filePath: string): ParsedSkillFrontmatter | null {
  try {
    const raw = readFileSync(filePath, READ_OPTS);
    const { data, content } = matter(raw);
    const name = typeof data.name === 'string' ? data.name : '';
    const description =
      typeof data.description === 'string'
        ? data.description
        : typeof data.description === 'object' && data.description !== null
          ? (data.description as { value?: string }).value ?? String(data.description)
          : '';
    return { name, description, raw: data as Record<string, unknown>, content };
  } catch {
    return null;
  }
}

export function parseMustSections(content: string): ParsedMust {
  return {
    mustInputs: extractMustNames(content, '## MUST 输入'),
    mustOutputs: extractMustNames(content, '## MUST 输出')
  };
}

function extractMustNames(content: string, heading: string): string[] {
  const start = content.indexOf(heading);
  if (start === -1) return [];
  const rest = content.slice(start + heading.length);
  const nextHeading = rest.search(/\n## /);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  const names: string[] = [];
  for (const line of section.split('\n')) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (match) names.push(match[1]);
  }
  return names;
}

export function parseAttackFrontmatter(
  filePath: string
): ParsedAttackFrontmatter | null {
  try {
    const raw = readFileSync(filePath, READ_OPTS);
    const { data } = matter(raw);
    return {
      source: String(data.source ?? ''),
      confidence: String(data.confidence ?? ''),
      platforms: toStringArray(data.platforms ?? []),
      requiredTools: toStringArray(data.required_tools ?? []),
      executionContexts: toStringArray(data.execution_contexts ?? []),
      maxVerificationLevel: String(data.max_verification_level ?? ''),
      destructive: Boolean(data.destructive ?? false),
      mappedAttackSurfaces: toStringArray(data.mapped_attack_surfaces ?? []),
      mappedComplianceFamilies: toStringArray(data.mapped_compliance_families ?? [])
    };
  } catch {
    return null;
  }
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

export function extractPhase(description: string, content: string = ''): string {
  const descMatch = description.match(/Phase\s*([0-9]+[a-zA-Z]?)/i);
  if (descMatch) return descMatch[1];
  const headingMatch = content.match(/^#\s+.*?Phase\s*([0-9]+[a-zA-Z]?)/im);
  if (headingMatch) return headingMatch[1];
  const bodyMatch = content.match(/Phase\s*([0-9]+[a-zA-Z]?)/i);
  return bodyMatch ? bodyMatch[1] : '';
}