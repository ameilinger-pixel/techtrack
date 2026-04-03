/**
 * Vite treats "#" and "?" in the project path as URL syntax and breaks (entry "#/index.html").
 * If the repo path contains those characters, we copy the tree to a temp directory (no #),
 * run `vite build` there, then copy dist/ back.
 * @see https://github.com/vitejs/vite/issues/13123
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const BAD_PATH = /[#?]/;

function runViteBuild(cwd) {
  const viteBin = path.join(cwd, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(viteBin)) {
    console.error('Could not find vite at', viteBin, '— run npm install from the project root.');
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [viteBin, 'build'], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  return r.status === 0;
}

function copyProjectForBuild(src, dest) {
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (p) => {
      const rel = path.relative(src, p);
      if (rel === '') return true;
      if (rel === 'dist' || rel.startsWith(`dist${path.sep}`)) return false;
      if (rel === '.git' || rel.startsWith(`.git${path.sep}`)) return false;
      return true;
    },
  });
}

function main() {
  if (!BAD_PATH.test(root)) {
    process.exit(runViteBuild(root) ? 0 : 1);
  }

  console.warn(
    '[vite] Your project path contains # or ?. Vite cannot build in-place (URL parsing).\n' +
      `[vite] Path: ${root}\n` +
      '[vite] Building from a temporary copy…'
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'techtrack-vite-build-'));
  try {
    copyProjectForBuild(root, tmp);
    if (!runViteBuild(tmp)) {
      process.exit(1);
    }
    const out = path.join(root, 'dist');
    fs.rmSync(out, { recursive: true, force: true });
    fs.cpSync(path.join(tmp, 'dist'), out, { recursive: true });
    console.log('[vite] dist/ written to:', out);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main();
