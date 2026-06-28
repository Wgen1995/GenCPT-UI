import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanGenCptAssets } from '../src/services/assetScanner.js';

describe('GenCPT asset scanner', () => {
  it('indexes GenCPT skill, security knowledge, harness assets and evolution assets', () => {
    const gencptPath = join(process.cwd(), '..', '..', 'gencpt');
    const index = scanGenCptAssets(gencptPath);

    expect(index.entrySkill.exists).toBe(true);
    expect(index.childSkills.length).toBeGreaterThanOrEqual(15);
    expect(index.sharedSpecs.length).toBeGreaterThanOrEqual(5);
    expect(index.compliance.totalRules).toBeGreaterThanOrEqual(226);
    expect(index.attackPatterns.length).toBeGreaterThanOrEqual(25);
    expect(index.hypotheses.files).toEqual(
      expect.arrayContaining([
        'compliance-hypotheses.md',
        'attack-hypotheses.md',
        'cross-ref-queries.md'
      ])
    );
    expect(index.harnessMechanisms.map((item) => item.id)).toContain('write-to-disk-first');
    expect(index.harnessMechanisms.map((item) => item.id)).toContain('anti-hallucination-six-rules');
    expect(index.harnessMechanisms.map((item) => item.id)).toContain('qa-three-layer');
  });

  it('extracts child skill frontmatter and MUST sections', () => {
    const gencptPath = join(process.cwd(), '..', '..', 'gencpt');
    const index = scanGenCptAssets(gencptPath);
    const recon = index.childSkills.find((s) => s.name === 'recon');
    expect(recon).toBeTruthy();
    expect(recon!.description).toContain('侦察');
    expect(recon!.phase).toBe('1a');
    expect(recon!.mustInputs.length).toBeGreaterThan(0);
    expect(recon!.mustOutputs.length).toBeGreaterThan(0);
    expect(recon!.requiresSsh).toBe(true);
  });

  it('extracts attack pattern frontmatter including isLearned flag', () => {
    const gencptPath = join(process.cwd(), '..', '..', 'gencpt');
    const index = scanGenCptAssets(gencptPath);
    const dockerApi = index.attackPatterns.find((p) => p.name === 'docker-api-auth');
    expect(dockerApi).toBeTruthy();
    expect(dockerApi!.attackSurface).toBe('AS-2');
    expect(dockerApi!.source).toBe('manual');
    expect(dockerApi!.confidence).toBe('high');
    expect(dockerApi!.platforms).toContain('docker');
    expect(dockerApi!.isLearned).toBe(false);
  });

  it('parses compliance rule counts from index files', () => {
    const gencptPath = join(process.cwd(), '..', '..', 'gencpt');
    const index = scanGenCptAssets(gencptPath);
    expect(index.compliance.k8s.rules).toBe(134);
    expect(index.compliance.docker.rules).toBe(64);
    expect(index.compliance.containerd.rules).toBe(28);
    expect(index.compliance.totalRules).toBe(226);
  });

  it('counts hypothesis cards from file bodies', () => {
    const gencptPath = join(process.cwd(), '..', '..', 'gencpt');
    const index = scanGenCptAssets(gencptPath);
    expect(index.hypotheses.chkCandCount).toBeGreaterThan(0);
    expect(index.hypotheses.atkHypCount).toBeGreaterThan(0);
    expect(index.hypotheses.xrefCount).toBeGreaterThan(0);
  });

  it('returns exists:false for missing gencpt home without throwing', () => {
    const index = scanGenCptAssets('/nonexistent/path/to/gencpt');
    expect(index.entrySkill.exists).toBe(false);
    expect(index.childSkills).toEqual([]);
    expect(index.attackPatterns).toEqual([]);
  });
});