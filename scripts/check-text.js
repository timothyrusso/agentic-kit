#!/usr/bin/env node
/**
 * Text guard for the kit's own files, run by `npm run check` and lefthook.
 *
 *   node scripts/check-text.js              every tracked and untracked, not ignored, file
 *   node scripts/check-text.js a.ts b.md    only the given files (pre-commit)
 *   node scripts/check-text.js --message F  a commit message file (commit-msg)
 *
 * Two rules. No em dash or en dash anywhere. No consuming app name and no GitHub project id in
 * `plugin/`, `packages/` or `template/`: those values come from `kit.config.json`.
 *
 * NOTE: the forbidden characters and words are built from code points and fragments, so this
 * file does not fail its own check and a repo-wide text replace cannot rewrite them.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const DASHES = [
  [EM, 'em dash'],
  [EN, 'en dash'],
];
const SCOPED_ROOTS = ['plugin/', 'packages/', 'template/'];
const FORBIDDEN_IN_SCOPED = [
  [new RegExp(['holi', 'dai'].join(''), 'i'), 'app name'],
  [new RegExp(['kine', 'tiq'].join(''), 'i'), 'app name'],
  [new RegExp(['\\bPVT', '(SSF|F)?_'].join('')), 'GitHub project id'],
];
const BINARY_EXTS = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|woff2?|ttf|otf)$/i;

function listFiles() {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    encoding: 'utf8',
  });
  return out.split('\0').filter(Boolean);
}

function scan(file, text, hits) {
  const scoped = SCOPED_ROOTS.some(root => file.startsWith(root));
  text.split('\n').forEach((line, i) => {
    for (const [ch, name] of DASHES) {
      if (line.includes(ch)) hits.push({ file, line: i + 1, name, excerpt: line.trim().slice(0, 96) });
    }
    if (!scoped) return;
    for (const [pattern, name] of FORBIDDEN_IN_SCOPED) {
      if (pattern.test(line)) hits.push({ file, line: i + 1, name, excerpt: line.trim().slice(0, 96) });
    }
  });
}

const args = process.argv.slice(2);
const hits = [];

if (args[0] === '--message') {
  const file = args[1];
  if (!file) {
    console.error('usage: check-text.js --message <commit message file>');
    process.exit(2);
  }
  scan('commit message', readFileSync(file, 'utf8'), hits);
} else {
  const files = args.length > 0 ? args : listFiles();
  for (const file of files) {
    if (BINARY_EXTS.test(file) || !existsSync(file) || !statSync(file).isFile()) continue;
    scan(file, readFileSync(file, 'utf8'), hits);
  }
}

if (hits.length === 0) process.exit(0);

console.error(`FAIL, ${hits.length} text violation(s). Use a colon, comma, parentheses or a hyphen for dashes;`);
console.error('take app names and project ids from kit.config.json.\n');
for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.name}  ${h.excerpt}`);
process.exit(1);
