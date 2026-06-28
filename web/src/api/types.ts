export interface ChildSkillEntry {
  name: string;
  phase: string;
  skillMdPath: string;
  description: string;
  requiresSsh: boolean;
  standalone: boolean;
  mustInputs: string[];
  mustOutputs: string[];
}

export interface SharedSpecEntry {
  name: string;
  path: string;
  exists: boolean;
}

export interface ComplianceBucket {
  rules: number;
  groups: number;
}

export interface ComplianceIndex {
  k8s: ComplianceBucket;
  docker: ComplianceBucket;
  containerd: ComplianceBucket;
  totalRules: number;
}

export interface AttackPatternEntry {
  name: string;
  attackSurface: string;
  source: string;
  confidence: string;
  platforms: string[];
  skillMdPath: string;
  isLearned: boolean;
}

export interface HypothesesIndex {
  files: string[];
  chkCandCount: number;
  atkHypCount: number;
  xrefCount: number;
}

export interface ReferenceEntry {
  name: string;
  path: string;
  exists: boolean;
}

export interface HarnessMechanism {
  id: string;
  name: string;
  category: string;
  description: string;
  relatedFile: string;
}

export interface AssetIndex {
  scannedAt: string;
  gencptHome: string;
  entrySkill: { exists: boolean; path: string };
  childSkills: ChildSkillEntry[];
  sharedSpecs: SharedSpecEntry[];
  compliance: ComplianceIndex;
  attackPatterns: AttackPatternEntry[];
  hypotheses: HypothesesIndex;
  references: ReferenceEntry[];
  tools: { indexExists: boolean; path: string };
  learnedPatterns: Array<{ name: string; path: string }>;
  harnessMechanisms: HarnessMechanism[];
}

export interface SessionListItem {
  id: string;
  source: string;
  status: string;
  server: string | null;
  mode: string | null;
  scope: string | null;
  approval: string | null;
  createdAt: string;
  updatedAt: string;
  summary: Record<string, unknown> | null;
}

export interface DashboardViewModel {
  assets: AssetIndex;
  sessions: SessionListItem[];
  currentSession: SessionListItem | null;
}

export interface CandidateChannel {
  id: string;
  label: string;
  description: string;
  sourceChannels: string[];
  inputSignalCount: number;
  candidateCount: number;
  items: Array<{ id?: string; label?: string; signal?: string }>;
}

export interface CandidatePanoramaViewModel {
  sessionId: string;
  channels: CandidateChannel[];
  assets: AssetIndex;
}

export interface QualityCheck {
  id: string;
  label: string;
  state: 'pass' | 'warn' | 'fail' | 'pending' | 'na';
  detail?: string;
}

export interface QualityGatesViewModel {
  sessionId: string;
  verdict: 'deliverable' | 'review' | 'blocked' | 'pending';
  checks: QualityCheck[];
  warnings: unknown[];
}

export interface ArtifactEntry {
  id: string;
  path: string;
  relativePath: string;
  absolutePath: string;
  kind: string;
  size?: number;
}

export interface ReportEntry {
  reportType: string;
  relativePath: string;
  size?: number;
}

export interface ReportsViewModel {
  reports: ReportEntry[];
  insights: unknown[];
}

export interface ArtifactListResponse {
  artifacts: ArtifactEntry[];
}