#!/usr/bin/env node
const { existsSync, mkdirSync, copyFileSync } = require('node:fs');
const { join } = require('node:path');

// Detect platform
const platform = process.platform; // 'linux' | 'darwin' | 'win32'
const arch = process.arch;         // 'x64' | 'arm64'

let pkgArch;
if (platform === 'linux') pkgArch = 'linux-x64';
else if (platform === 'darwin') pkgArch = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
else if (platform === 'win32') pkgArch = 'win32-x64';
else { console.log(`Unsupported platform: ${platform}/${arch}`); process.exit(1); }

const vendorBinary = join(__dirname, '..', 'vendor', 'better-sqlite3', pkgArch, 'better_sqlite3.node');
if (!existsSync(vendorBinary)) {
  console.log(`Vendor binary not found for ${pkgArch}: ${vendorBinary}`);
  process.exit(1);
}

// Find better-sqlite3 in node_modules (pnpm store path)
const fs = require('node:fs');
const path = require('node:path');
function findDir(root, name) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && e.name.startsWith(name)) return path.join(root, e.name);
  }
  return null;
}
const pnpmDir = path.join(__dirname, '..', 'node_modules', '.pnpm');
const bsqDir = findDir(pnpmDir, 'better-sqlite3@');
if (!bsqDir) { console.log('better-sqlite3 not found in pnpm store'); process.exit(1); }

const target = path.join(bsqDir, 'node_modules', 'better-sqlite3', 'build', 'Release');
mkdirSync(target, { recursive: true });
copyFileSync(vendorBinary, path.join(target, 'better_sqlite3.node'));
console.log(`better-sqlite3 binary installed for ${pkgArch}`);
