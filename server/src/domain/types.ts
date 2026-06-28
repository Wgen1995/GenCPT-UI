export type WorkbenchConfig = {
  server: { host: string; port: number };
  opencode: { command: string; timeoutMs: number };
  gencpt: { home?: string; sessionRoot: string; autoDetect: boolean };
  storage: { dataDir: string; artifactDir: string };
};

export type EnvironmentCheckResult = {
  opencode: { available: boolean; command: string; error?: string };
  gencpt: {
    available: boolean;
    home: string;
    requiredAssets: Array<{ name: string; path: string; exists: boolean }>;
  };
  artifactDir: { path: string; writable: boolean };
  sessionRoot: { path: string; readable: boolean };
};

export type DiscoverInput = {
  cwd: string;
  env?: Record<string, string | undefined>;
  historicalPath?: string;
};

export type AssetIndex = {
  scannedAt: string;
  gencptHome: string;
  entrySkill: { exists: boolean; path: string };
  childSkills: Array<{
    name: string;
    phase: string;
    skillMdPath: string;
    description: string;
    requiresSsh: boolean;
    standalone: boolean;
    mustInputs: string[];
    mustOutputs: string[];
  }>;
  sharedSpecs: Array<{ name: string; path: string; exists: boolean }>;
  compliance: {
    k8s: { rules: number; groups: number };
    docker: { rules: number; groups: number };
    containerd: { rules: number; groups: number };
    totalRules: number;
  };
  attackPatterns: Array<{
    name: string;
    attackSurface: string;
    source: string;
    confidence: string;
    platforms: string[];
    skillMdPath: string;
    isLearned: boolean;
  }>;
  hypotheses: {
    files: string[];
    chkCandCount: number;
    atkHypCount: number;
    xrefCount: number;
  };
  references: Array<{ name: string; path: string; exists: boolean }>;
  tools: { indexExists: boolean; path: string };
  learnedPatterns: Array<{ name: string; path: string }>;
  harnessMechanisms: Array<{
    id: string;
    name: string;
    category: 'Harness Engineering' | 'Quality Gate' | 'Safety Control' | 'Evolution' | 'Evidence Governance';
    description: string;
    relatedFile: string;
  }>;
};