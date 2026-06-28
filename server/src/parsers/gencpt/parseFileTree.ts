import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

export type FileTreeEntry = {
  relativePath: string;
  size: number;
};

export type ParsedFileTree = {
  files: FileTreeEntry[];
  fileCount: number;
  totalSize: number;
  warnings: string[];
};

function walk(dir: string, base: string, out: FileTreeEntry[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, base, out);
    } else if (entry.isFile()) {
      let size = 0;
      try {
        size = statSync(full).size;
      } catch {
        size = 0;
      }
      out.push({ relativePath: relative(base, full), size });
    }
  }
}

export function parseFileTree(root: string): ParsedFileTree {
  const warnings: string[] = [];
  if (!existsSync(root)) {
    warnings.push(`file tree root missing: ${root}`);
    return { files: [], fileCount: 0, totalSize: 0, warnings };
  }
  const files: FileTreeEntry[] = [];
  walk(root, root, files);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  return { files, fileCount: files.length, totalSize, warnings };
}