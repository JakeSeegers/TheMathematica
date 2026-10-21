// `npm run typecheck`: the TypeScript check of the JavaScript through its JSDoc (conventions:
// docs/development/CONVENTIONS.md §3). Runs tsc on both programs — tsconfig.json (src/ and
// sandbox/, browser globals) and tools/tsconfig.json (the Node tools) — and exits 1 if either
// reports an error. Both run even when the first fails, so one call lists every error. Nothing is
// emitted; takes about a second.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
let failed = false;
for (const project of ['tsconfig.json', 'tools/tsconfig.json']) {
  const t0 = performance.now();
  const r = spawnSync(process.execPath, [tsc, '-p', project, ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
  const ok = r.status === 0;
  failed ||= !ok;
  console.log(`typecheck ${project}: ${ok ? 'ok' : 'FAILED'} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
}
process.exit(failed ? 1 : 0);
