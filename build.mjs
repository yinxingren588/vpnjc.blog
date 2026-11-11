import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');

const EXCLUDED_TOP_LEVEL = new Set([
  '.git',
  '.github',
  '.gitignore',
  '__pycache__',
  'node_modules',
  'dist',
  'package.json',
  'package-lock.json',
  'build.mjs',
  'scripts',
  '.indexnow-state.json',
]);

/**
 * Recursively copy static site entries into dist/, returning copied file count.
 * @param {string} src
 * @param {string} dest
 * @returns {number}
 */
function copyEntry(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    let count = 0;
    for (const entry of fs.readdirSync(src)) {
      if (entry === '.DS_Store' || entry === 'Thumbs.db' || entry === '__pycache__') {
        continue;
      }
      count += copyEntry(path.join(src, entry), path.join(dest, entry));
    }
    return count;
  }
  fs.copyFileSync(src, dest);
  return 1;
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

let totalFiles = 0;
for (const entry of fs.readdirSync(rootDir)) {
  if (EXCLUDED_TOP_LEVEL.has(entry)) {
    continue;
  }
  totalFiles += copyEntry(path.join(rootDir, entry), path.join(distDir, entry));
}

console.log(`Built static site into dist/: ${totalFiles} files copied.`);
