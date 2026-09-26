#!/usr/bin/env node
/**
 * The plugin and `config-presets` ship copies of files whose source of truth lives elsewhere, so
 * each published output is self-contained:
 *
 * - the root docs (ARCHITECTURE.md and the rest) into `plugin/docs/`, which the agents read at
 *   run start through `${CLAUDE_PLUGIN_ROOT}/docs/`;
 * - the Feature issue template from `plugin/templates/ISSUE_TEMPLATE/` into
 *   `packages/config-presets/github/ISSUE_TEMPLATE/`, which `config-presets init` writes into an app.
 *
 *   node scripts/sync-plugin-docs.js           copy every source that exists (idempotent)
 *   node scripts/sync-plugin-docs.js --check   fail when a copy is missing, stale or orphaned
 *
 * A root doc that does not exist yet is skipped, and so is its copy; a copy whose source was
 * deleted is removed by a sync and reported by `--check`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DOCS = ['ARCHITECTURE.md', 'ERROR_HANDLING.md', 'AGENTIC_WORKFLOW.md', 'EFFECT_PRIMER.md', 'MIGRATION_GUIDE.md'];
const DOCS_COPY_DIR = 'plugin/docs';
const DOCS_KEEP = new Set(['README.md']);
const TEMPLATE_DIR = 'plugin/templates/ISSUE_TEMPLATE';
const TEMPLATE_COPY_DIR = 'packages/config-presets/github/ISSUE_TEMPLATE';

function read(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/** Every source and copy pair, plus the copies that no longer have a source. */
function plan() {
  const pairs = [];
  for (const doc of DOCS) if (existsSync(doc)) pairs.push({ from: doc, to: join(DOCS_COPY_DIR, doc) });
  for (const name of existsSync(TEMPLATE_DIR) ? readdirSync(TEMPLATE_DIR).sort() : []) {
    pairs.push({ from: join(TEMPLATE_DIR, name), to: join(TEMPLATE_COPY_DIR, name) });
  }
  const wanted = new Set(pairs.map(pair => pair.to));
  const orphans = [];
  for (const [dir, keep] of [
    [DOCS_COPY_DIR, DOCS_KEEP],
    [TEMPLATE_COPY_DIR, new Set()],
  ]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const file = join(dir, name);
      if (!keep.has(name) && !wanted.has(file)) orphans.push(file);
    }
  }
  return { pairs, orphans };
}

const { pairs, orphans } = plan();

if (process.argv.includes('--check')) {
  const problems = [
    ...pairs.filter(({ from, to }) => read(to) !== read(from)).map(({ from, to }) => `${to} differs from ${from}`),
    ...orphans.map(file => `${file} has no source`),
  ];
  if (problems.length > 0) {
    console.error(`FAIL: ${problems.join('; ')}. Run \`npm run sync:plugin-docs\`.`);
    process.exit(1);
  }
  process.exit(0);
}

for (const { from, to } of pairs) {
  const source = read(from);
  if (read(to) === source) continue;
  mkdirSync(join(to, '..'), { recursive: true });
  writeFileSync(to, source);
  console.log(`Copied ${from} to ${to}`);
}
for (const file of orphans) {
  rmSync(file);
  console.log(`Removed ${file} (no source)`);
}
const missing = DOCS.filter(doc => !existsSync(doc));
if (missing.length > 0) console.log(`Not yet written, skipped: ${missing.join(', ')}`);
