import { existsSync, mkdirSync, accessSync, constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import type { EnvironmentCheckResult, DiscoverInput } from '../domain/types.js';

const REQUIRED_ASSETS = [
  'SKILL.md',
  'skills',
  'skills/shared',
  'attack-patterns',
  'compliance-rules',
  'hypothesis-libraries',
  'references'
];

export function discoverGenCptHome(input: DiscoverInput): string | null {
  // 1. Environment variable
  if (input.env?.GENCPT_HOME) {
    const p = resolve(input.env.GENCPT_HOME);
    if (existsSync(join(p, 'SKILL.md'))) return p;
  }

  // 2. Historical config (placeholder - not yet persisted)
  if (input.historicalPath) {
    const p = resolve(input.historicalPath);
    if (existsSync(join(p, 'SKILL.md'))) return p;
  }

  // 3. Sibling directory
  const sibling = resolve(input.cwd, '..', 'gencpt');
  if (existsSync(join(sibling, 'SKILL.md'))) return sibling;

  // 4. Common dev directory
  const commonDev = '/root/ForAI/gencpt';
  if (existsSync(join(commonDev, 'SKILL.md'))) return commonDev;

  // 5. opencode skills common directories
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
  const opencodePaths = [
    join(homeDir, '.config', 'opencode', 'skills', 'gencpt'),
    join(homeDir, '.config', 'opencode', 'skills', 'GenCPT'),
    join(homeDir, '.opencode', 'skills', 'gencpt')
  ];
  for (const p of opencodePaths) {
    if (existsSync(join(p, 'SKILL.md'))) return p;
  }

  return null;
}

export function checkEnvironment(params: {
  opencodeCommand: string;
  gencptHome: string;
  artifactDir: string;
  sessionRoot: string;
}): EnvironmentCheckResult {
  // Check opencode
  let opencodeAvailable = false;
  let opencodeError: string | undefined;
  try {
    execFileSync(params.opencodeCommand, ['--version'], { timeout: 5000, stdio: 'pipe' });
    opencodeAvailable = true;
  } catch (e) {
    opencodeAvailable = false;
    opencodeError = e instanceof Error ? e.message : String(e);
  }

  // Check GenCPT assets
  const requiredAssets = REQUIRED_ASSETS.map((name) => ({
    name,
    path: join(params.gencptHome, name),
    exists: existsSync(join(params.gencptHome, name))
  }));

  const gencptAvailable = requiredAssets.every((a) => a.exists);

  // Ensure artifact dir
  mkdirSync(params.artifactDir, { recursive: true });
  let artifactWritable = true;
  try {
    accessSync(params.artifactDir, constants.W_OK);
  } catch {
    artifactWritable = false;
  }

  // Check session root
  let sessionReadable = false;
  try {
    accessSync(params.sessionRoot, constants.R_OK);
    sessionReadable = true;
  } catch {
    // /tmp might not pass accessSync in some envs, be lenient
    sessionReadable = existsSync(params.sessionRoot);
  }

  return {
    opencode: { available: opencodeAvailable, command: params.opencodeCommand, error: opencodeError },
    gencpt: {
      available: gencptAvailable,
      home: params.gencptHome,
      requiredAssets
    },
    artifactDir: { path: params.artifactDir, writable: artifactWritable },
    sessionRoot: { path: params.sessionRoot, readable: sessionReadable }
  };
}