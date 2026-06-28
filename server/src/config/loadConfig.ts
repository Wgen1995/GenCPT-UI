import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { z } from 'zod';
import type { WorkbenchConfig } from '../domain/types.js';

const RawConfigSchema = z.object({
  server: z.object({ host: z.string(), port: z.number().int().positive() }),
  opencode: z.object({ command: z.string(), timeout_ms: z.number().int().positive() }),
  gencpt: z.object({
    home: z.string().optional(),
    session_root: z.string(),
    auto_detect: z.boolean().default(true)
  }),
  storage: z.object({ data_dir: z.string(), artifact_dir: z.string() })
});

export function loadConfig(configPath: string): WorkbenchConfig {
  const rawText = readFileSync(configPath, 'utf8');
  const raw = RawConfigSchema.parse(loadYaml(rawText));
  const baseDir = dirname(configPath);

  return {
    server: raw.server,
    opencode: { command: raw.opencode.command, timeoutMs: raw.opencode.timeout_ms },
    gencpt: {
      home: raw.gencpt.home ? resolve(baseDir, raw.gencpt.home) : undefined,
      sessionRoot: raw.gencpt.session_root,
      autoDetect: raw.gencpt.auto_detect
    },
    storage: {
      dataDir: resolve(baseDir, raw.storage.data_dir),
      artifactDir: resolve(baseDir, raw.storage.artifact_dir)
    }
  };
}