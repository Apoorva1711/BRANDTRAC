import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const zipPath = path.join(rootDir, 'BRANDTRACE-Full-Project.zip');
const stageBase = path.join(rootDir, '_staging');
const projectFolder = path.join(stageBase, 'BRANDTRACE-Full-Project');

console.log('Packaging BRANDTRACE-Full-Project.zip...');

// Cleanup old staging or zip
if (fs.existsSync(stageBase)) {
  fs.rmSync(stageBase, { recursive: true, force: true });
}
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

fs.mkdirSync(projectFolder, { recursive: true });

const IGNORE_PATTERNS = [
  'node_modules',
  'venv',
  '.venv',
  'dist',
  '.pytest_cache',
  '__pycache__',
  '.env',
  '_staging',
  'BRANDTRACE-Full-Project.zip',
  '.git'
];

function shouldInclude(relPath) {
  const parts = relPath.split(path.sep);
  for (const part of parts) {
    if (IGNORE_PATTERNS.includes(part)) {
      return false;
    }
    if (part.endsWith('.pyc') || part.endsWith('.log')) {
      return false;
    }
  }
  return true;
}

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      const srcChild = path.join(src, entry);
      const destChild = path.join(dest, entry);
      const relPath = path.relative(rootDir, srcChild);
      if (shouldInclude(relPath)) {
        copyRecursive(srcChild, destChild);
      }
    }
  } else {
    const relPath = path.relative(rootDir, src);
    if (shouldInclude(relPath)) {
      fs.copyFileSync(src, dest);
    }
  }
}

console.log('Staging files into BRANDTRACE-Full-Project root directory...');
copyRecursive(rootDir, projectFolder);

console.log('Creating ZIP archive with root directory BRANDTRACE-Full-Project/ ...');
const powershellCmd = `Compress-Archive -Path "${projectFolder}" -DestinationPath "${zipPath}" -Force`;
execSync(`powershell -NoProfile -Command "${powershellCmd}"`, { stdio: 'inherit' });

console.log('Cleaning up staging directory...');
fs.rmSync(stageBase, { recursive: true, force: true });

const zipStats = fs.statSync(zipPath);
console.log(`\n======================================================`);
console.log(`✅ BRANDTRACE-Full-Project.zip created successfully!`);
console.log(`📁 Path: ${zipPath}`);
console.log(`📦 Size: ${(zipStats.size / (1024 * 1024)).toFixed(2)} MB`);
console.log(`📂 Root folder: BRANDTRACE-Full-Project/`);
console.log(`======================================================\n`);
