import type Database from 'better-sqlite3';
import { readFileSync, statSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export type Artifact = {
  id: number;
  sessionId: string;
  relativePath: string;
  absolutePath: string;
  artifactType: string;
  size: number;
  sha256: string | null;
  createdAt: string;
};

export type IndexArtifactInput = {
  sessionId: string;
  relativePath: string;
  absolutePath: string;
  artifactType: string;
  size: number;
  sha256?: string;
};

type ArtifactRow = {
  id: number;
  session_id: string;
  relative_path: string;
  absolute_path: string;
  artifact_type: string;
  size: number;
  sha256: string | null;
  created_at: string;
};

function rowToArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    sessionId: row.session_id,
    relativePath: row.relative_path,
    absolutePath: row.absolute_path,
    artifactType: row.artifact_type,
    size: row.size,
    sha256: row.sha256,
    createdAt: row.created_at
  };
}

export function computeSha256(filePath: string): string {
  const buf = readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

export function copyDirectory(src: string, dest: string): void {
  const srcStat = statSync(src);
  if (!srcStat.isDirectory()) throw new Error(`src is not a directory: ${src}`);
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      throw new Error(`refusing to copy symlink: ${srcPath}`);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export function indexArtifact(db: Database.Database, input: IndexArtifactInput): Artifact {
  const now = new Date().toISOString();
  const sha256 = input.sha256 && input.sha256.length > 0 ? input.sha256 : computeSha256(input.absolutePath);
  const info = db
    .prepare(
      `INSERT INTO artifacts (session_id, relative_path, absolute_path, artifact_type, size, sha256, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.sessionId,
      input.relativePath,
      input.absolutePath,
      input.artifactType,
      input.size,
      sha256,
      now
    );
  const row = db.prepare('SELECT * FROM artifacts WHERE id = ?').get(info.lastInsertRowid) as ArtifactRow;
  return rowToArtifact(row);
}

export function listArtifacts(db: Database.Database, sessionId: string): Artifact[] {
  const rows = db
    .prepare('SELECT * FROM artifacts WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as ArtifactRow[];
  return rows.map(rowToArtifact);
}

export function getArtifactContent(absolutePath: string): string {
  return readFileSync(absolutePath, 'utf8');
}