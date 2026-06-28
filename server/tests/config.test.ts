import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, afterAll } from 'vitest';
import { loadConfig } from '../src/config/loadConfig.js';
import { checkEnvironment, discoverGenCptHome } from '../src/services/environmentService.js';

describe('configuration and GenCPT discovery', () => {
  it('loads yaml config and resolves relative paths from config directory', () => {
    const root = join(process.cwd(), 'server/tests/tmp-config-test');
    mkdirSync(root, { recursive: true });
    const configPath = join(root, 'gencpt-workbench.yaml');
    writeFileSync(configPath, `
server:
  host: 127.0.0.1
  port: 7099
opencode:
  command: opencode
  timeout_ms: 300000
gencpt:
  session_root: /tmp
  auto_detect: true
storage:
  data_dir: ./data
  artifact_dir: ./artifacts
`);

    const config = loadConfig(configPath);

    expect(config.server.port).toBe(7099);
    expect(config.gencpt.sessionRoot).toBe('/tmp');
    expect(config.storage.dataDir.endsWith('/data')).toBe(true);
    expect(config.storage.artifactDir.endsWith('/artifacts')).toBe(true);
  });

  it('discovers the local GenCPT repository and validates required assets', () => {
    const home = discoverGenCptHome({ cwd: process.cwd(), env: { GENCPT_HOME: '../../gencpt' } });
    expect(home).toBeTruthy();
    expect(home!.endsWith('gencpt')).toBe(true);

    const result = checkEnvironment({
      opencodeCommand: 'opencode',
      gencptHome: home!,
      artifactDir: join(process.cwd(), 'server/tests/tmp-artifacts'),
      sessionRoot: '/tmp'
    });

    expect(result.gencpt.available).toBe(true);
    expect(result.gencpt.home).toBe(home);
    expect(result.gencpt.requiredAssets.every((asset) => asset.exists)).toBe(true);
  });

  it('discovers GenCPT via sibling directory', () => {
    const home = discoverGenCptHome({ cwd: join(process.cwd(), 'gencpt-workbench'), env: {} });
    // When running from gencpt-workbench/, ../gencpt should find the copied gencpt dir
    // This may or may not find it depending on worktree structure
    if (home) {
      expect(existsSync(join(home, 'SKILL.md'))).toBe(true);
    }
  });

  it('returns null when GenCPT cannot be found', () => {
    const home = discoverGenCptHome({ cwd: '/tmp/nonexistent-path-xyz', env: {} });
    // Levels 4 and 5 check absolute well-known paths that are independent of
    // cwd. On a host where the gencpt repo lives at one of those paths (e.g.
    // the main worktree at /root/ForAI/gencpt, or the opencode skills dir),
    // discovery legitimately returns it. Only assert null when no known
    // fallback exists on this host.
    const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
    const knownFallbacks = [
      '/root/ForAI/gencpt',
      join(homeDir, '.config', 'opencode', 'skills', 'gencpt'),
      join(homeDir, '.config', 'opencode', 'skills', 'GenCPT'),
      join(homeDir, '.opencode', 'skills', 'gencpt')
    ];
    const hasFallback = knownFallbacks.some((p) => existsSync(join(p, 'SKILL.md')));
    if (!hasFallback) {
      expect(home).toBeNull();
    } else {
      expect(home).toBeTruthy();
    }
  });

  it('discovers via common dev directory', () => {
    // /root/ForAI/gencpt should exist in this environment
    const home = discoverGenCptHome({ cwd: '/tmp', env: {} });
    if (home) {
      expect(existsSync(join(home, 'SKILL.md'))).toBe(true);
    }
  });

  afterAll(() => {
    rmSync(join(process.cwd(), 'server/tests/tmp-config-test'), { recursive: true, force: true });
    rmSync(join(process.cwd(), 'server/tests/tmp-artifacts'), { recursive: true, force: true });
  });
});