import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import fastGlob from 'fast-glob';
import matter from 'gray-matter';
import type { AssetIndex } from '../domain/types.js';
import {
  parseAttackFrontmatter,
  parseMustSections,
  parseSkillFrontmatter,
  extractPhase
} from '../parsers/gencpt/parseAssets.js';

const READ_OPTS = { encoding: 'utf-8' } as const;
const SHARED_SPEC_FILES = [
  'OUTPUT_STANDARD.md',
  'SSH_COMMANDS.md',
  'SEVERITY_RATING.md',
  'VULNERABILITY_GROUPING.md',
  'QA_OVERRIDE_TRACKING.md'
];
const REFERENCE_FILES = [
  'attack-surface-model.md',
  'promotion-criteria.md',
  'compliance.md',
  'workspace-contract.md',
  'promotion-template.md',
  'quality_check_templates.md'
];

type HarnessMechanism = AssetIndex['harnessMechanisms'][number];

const HARNESS_MECHANISMS: HarnessMechanism[] = [
  {
    id: 'write-to-disk-first',
    name: '写盘优先',
    category: 'Evidence Governance',
    description: '所有检测中间产物先写入工作目录磁盘，再上行摘要',
    relatedFile: 'skills/shared/OUTPUT_STANDARD.md'
  },
  {
    id: 'summary-uplink',
    name: '摘要上行',
    category: 'Evidence Governance',
    description: '步骤间只传摘要节点，全文以磁盘文件为准',
    relatedFile: 'skills/shared/OUTPUT_STANDARD.md'
  },
  {
    id: 'on-demand-read',
    name: '按需读取',
    category: 'Evidence Governance',
    description: '下游步骤按需 Read 磁盘文件而非依赖上游上下文',
    relatedFile: 'skills/shared/OUTPUT_STANDARD.md'
  },
  {
    id: 'wu-batching',
    name: 'WU 分批',
    category: 'Harness Engineering',
    description: '工作单元按 Phase 切片，单步只承担一个子任务',
    relatedFile: 'references/workspace-contract.md'
  },
  {
    id: 'must-input-output',
    name: 'MUST 输入/输出',
    category: 'Harness Engineering',
    description: '每个子 SKILL 声明 MUST 输入与 MUST 输出契约',
    relatedFile: 'references/workspace-contract.md'
  },
  {
    id: 'phase-checkpoint',
    name: 'Phase Checkpoint',
    category: 'Harness Engineering',
    description: '阶段间设检查点，下游因前置缺失则跳过并记录',
    relatedFile: 'references/workspace-contract.md'
  },
  {
    id: 'anti-hallucination-six-rules',
    name: '反幻觉六条',
    category: 'Quality Gate',
    description: '不准凭记忆出命令、必须同步磁盘、必须附原始输出等六条反幻觉约束',
    relatedFile: 'SKILL.md'
  },
  {
    id: 'ssh-rate-limit-retry',
    name: 'SSH 限速重试',
    category: 'Harness Engineering',
    description: 'SSH 命令标注执行上下文 [L0]/[L1]/[L2]，限速与重试',
    relatedFile: 'skills/shared/SSH_COMMANDS.md'
  },
  {
    id: 'approval-gating',
    name: '审批门控',
    category: 'Safety Control',
    description: '5 级审批门控：L0 自动 / L1 提示 / L2 二次确认 / 破坏性人工 / 熔断中止',
    relatedFile: 'SKILL.md'
  },
  {
    id: 'safety-circuit-breaker',
    name: '安全熔断',
    category: 'Safety Control',
    description: '遇到非授权目标或破坏性操作未确认时立即中止 Pipeline',
    relatedFile: 'SKILL.md'
  },
  {
    id: 'compliance-triple-verification',
    name: '合规三重校验',
    category: 'Quality Gate',
    description: '规则文本 + SSH 实测输出 + 判定理由三重并存，缺一即 FAIL',
    relatedFile: 'SKILL.md'
  },
  {
    id: 'qa-three-layer',
    name: 'QA 三层',
    category: 'Quality Gate',
    description: '自检/语义抽检/abstract review 三层 QA 校验',
    relatedFile: 'skills/shared/QA_OVERRIDE_TRACKING.md'
  },
  {
    id: 'baseline-no-override',
    name: 'baseline 不替代当前验证',
    category: 'Quality Gate',
    description: '历史 baseline 仅影响优先级，不得替代当前事实校验',
    relatedFile: 'SKILL.md'
  },
  {
    id: 'method-c-toolkit',
    name: '方法 C 工具库',
    category: 'Harness Engineering',
    description: 'methods/toolkit 目录提供与本次检测强关联的只读工具集',
    relatedFile: 'tools/_index.md'
  },
  {
    id: 'episodic-memory-priority-only',
    name: '情节记忆只影响优先级',
    category: 'Evolution',
    description: '历史 baseline 仅用于优先级排序，不替代实测验断',
    relatedFile: 'SKILL.md'
  }
];

export function scanGenCptAssets(gencptHome: string): AssetIndex {
  const root = gencptHome;
  const exists = existsSync(join(root, 'SKILL.md'));

  if (!exists) {
    return {
      scannedAt: new Date().toISOString(),
      gencptHome: root,
      entrySkill: { exists: false, path: join(root, 'SKILL.md') },
      childSkills: [],
      sharedSpecs: SHARED_SPEC_FILES.map((name) => ({
        name,
        path: join(root, 'skills', 'shared', name),
        exists: false
      })),
      compliance: {
        k8s: { rules: 0, groups: 0 },
        docker: { rules: 0, groups: 0 },
        containerd: { rules: 0, groups: 0 },
        totalRules: 0
      },
      attackPatterns: [],
      hypotheses: { files: [], chkCandCount: 0, atkHypCount: 0, xrefCount: 0 },
      references: REFERENCE_FILES.map((name) => ({
        name,
        path: join(root, 'references', name),
        exists: false
      })),
      tools: { indexExists: false, path: join(root, 'tools', '_index.md') },
      learnedPatterns: [],
      harnessMechanisms: HARNESS_MECHANISMS
    };
  }

  const childSkills = scanChildSkills(root);
  const sharedSpecs = scanSharedSpecs(root);
  const compliance = scanCompliance(root);
  const { attackPatterns, learnedPatterns } = scanAttackPatterns(root);
  const hypotheses = scanHypotheses(root);
  const references = scanReferences(root);
  const tools = scanTools(root);

  return {
    scannedAt: new Date().toISOString(),
    gencptHome: root,
    entrySkill: { exists: true, path: join(root, 'SKILL.md') },
    childSkills,
    sharedSpecs,
    compliance,
    attackPatterns,
    hypotheses,
    references,
    tools,
    learnedPatterns,
    harnessMechanisms: HARNESS_MECHANISMS
  };
}

function scanChildSkills(root: string): AssetIndex['childSkills'] {
  const pattern = 'skills/*/SKILL.md';
  const files = fastGlob.sync(pattern, { cwd: root, onlyFiles: true });
  const out: AssetIndex['childSkills'] = [];
  for (const rel of files.sort()) {
    const abs = join(root, rel);
    const parsed = parseSkillFrontmatter(abs);
    if (!parsed) continue;
    const name = parsed.name || rel.split(sep)[1] || '';
    const phase = extractPhase(parsed.description, parsed.content ?? '');
    const { mustInputs, mustOutputs } = parseMustSections(parsed.content ?? '');
    out.push({
      name,
      phase,
      skillMdPath: abs,
      description: parsed.description,
      requiresSsh: /ssh/i.test(parsed.description) || /ssh/i.test(parsed.content ?? ''),
      standalone: /独立运行/.test(parsed.description),
      mustInputs,
      mustOutputs
    });
  }
  return out;
}

function scanSharedSpecs(root: string): AssetIndex['sharedSpecs'] {
  return SHARED_SPEC_FILES.map((name) => {
    const p = join(root, 'skills', 'shared', name);
    return { name, path: p, exists: existsSync(p) };
  });
}

function scanCompliance(root: string): AssetIndex['compliance'] {
  const k8s = parseComplianceIndex(join(root, 'compliance-rules', 'kubernetes', '_index.md'));
  const docker = parseComplianceIndex(join(root, 'compliance-rules', 'docker', '_index.md'));
  const containerd = parseComplianceIndex(join(root, 'compliance-rules', 'containerd', '_index.md'));
  return {
    k8s,
    docker,
    containerd,
    totalRules: k8s.rules + docker.rules + containerd.rules
  };
}

function parseComplianceIndex(
  indexPath: string
): { rules: number; groups: number } {
  try {
    const content = readFileSync(indexPath, READ_OPTS);
    const ruleMatch = content.match(/共\s*(\d+)\s*条/);
    const groupLineMatch = content.match(/(\d+)\s*个分组/);
    let groups = groupLineMatch ? parseInt(groupLineMatch[1], 10) : 0;
    if (groups === 0) {
      const tableRows = content.match(/^\|\s*G_\d+/gm);
      groups = tableRows ? tableRows.length : 0;
    }
    let rules = ruleMatch ? parseInt(ruleMatch[1], 10) : 0;
    if (rules === 0) {
      const tableRows = content.match(/^\|\s*G_\d+.*\|\s*(\d+)\s*\|/gm);
      if (tableRows) {
        rules = tableRows
          .map((row) => {
            const m = row.match(/\|\s*(\d+)\s*\|\s*$/);
            return m ? parseInt(m[1], 10) : 0;
          })
          .reduce((a, b) => a + b, 0);
      }
    }
    return { rules, groups };
  } catch {
    return { rules: 0, groups: 0 };
  }
}

function scanAttackPatterns(
  root: string
): { attackPatterns: AssetIndex['attackPatterns']; learnedPatterns: Array<{ name: string; path: string }> } {
  const pattern = 'attack-patterns/**/SKILL.md';
  const files = fastGlob.sync(pattern, { cwd: root, onlyFiles: true });
  const attackPatterns: AssetIndex['attackPatterns'] = [];
  const learnedPatterns: Array<{ name: string; path: string }> = [];
  const surfaceByDir = parseAttackSurfaceMap(join(root, 'attack-patterns', '_index.md'));

  for (const rel of files.sort()) {
    const abs = join(root, rel);
    const parts = rel.split(sep);
    const surfaceDir = parts[1];
    const patternName = parts[2];
    const surfaceId = surfaceByDir.get(surfaceDir) ?? '';
    const isLearned = parts.some((p) => p === '_learned');

    const fm = parseAttackFrontmatter(abs);
    if (!fm) continue;

    if (isLearned) {
      learnedPatterns.push({ name: patternName, path: abs });
      continue;
    }

    attackPatterns.push({
      name: patternName,
      attackSurface: surfaceId,
      source: fm.source,
      confidence: fm.confidence,
      platforms: fm.platforms,
      skillMdPath: abs,
      isLearned
    });
  }
  return { attackPatterns, learnedPatterns };
}

function parseAttackSurfaceMap(indexPath: string): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const content = readFileSync(indexPath, READ_OPTS);
    const lines = content.split('\n');
    for (const line of lines) {
      const m = line.match(/^\|\s*(AS-\d+)\s*\|\s*[^|]+\|\s*`([^`]+)\/`\s*\|/);
      if (m) map.set(m[2], m[1]);
    }
  } catch {
    /* ignore */
  }
  return map;
}

function scanHypotheses(root: string): AssetIndex['hypotheses'] {
  const dir = join(root, 'hypothesis-libraries');
  const files: string[] = [];
  let chkCandCount = 0;
  let atkHypCount = 0;
  let xrefCount = 0;
  try {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.md')) continue;
      files.push(name);
      const content = readFileSync(join(dir, name), READ_OPTS);
      chkCandCount += countMatches(content, /^### CHK-CAND-/gm);
      atkHypCount += countMatches(content, /^### ATK-HYP-/gm);
      xrefCount += countMatches(content, /^### XREF-/gm);
    }
  } catch {
    /* ignore */
  }
  return { files, chkCandCount, atkHypCount, xrefCount };
}

function countMatches(content: string, re: RegExp): number {
  const matches = content.match(re);
  return matches ? matches.length : 0;
}

function scanReferences(root: string): AssetIndex['references'] {
  const refDir = join(root, 'references');
  const out: Array<{ name: string; path: string; exists: boolean }> = [];
  const seen = new Set<string>();
  for (const name of REFERENCE_FILES) {
    const p = join(refDir, name);
    out.push({ name, path: p, exists: existsSync(p) });
    seen.add(name);
  }
  try {
    for (const name of readdirSync(refDir)) {
      if (!name.endsWith('.md')) continue;
      if (seen.has(name)) continue;
      const p = join(refDir, name);
      if (statSync(p).isFile()) {
        out.push({ name, path: p, exists: true });
        seen.add(name);
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

function scanTools(root: string): AssetIndex['tools'] {
  const p = join(root, 'tools', '_index.md');
  return { indexExists: existsSync(p), path: p };
}

export const __testInternals = { HARNESS_MECHANISMS, parseAttackSurfaceMap, matter };