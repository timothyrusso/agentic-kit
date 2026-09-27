#!/usr/bin/env node
/**
 * Publishes `template/` as the GitHub template repository `timothyrusso/expo-kit-template`.
 *
 *   npm run template:sync -- --issue <n> [--dry-run] [--repo <owner/name>] [--dir <folder>]
 *
 * 1. Stages the files git tracks under `template/` (untracked and ignored files stay behind).
 * 2. Adds a `package-lock.json` when the kit version the template depends on is on npm, so the
 *    template's `npm ci` works; before the first release there is none, and the script says so.
 * 3. Creates the repository when it is missing (public, then marked as a template) and replaces
 *    its `main` with the staged files in one commit, `chore(<n>): sync from agentic-kit <sha>`.
 *    Nothing is committed when the files already match.
 *
 * `--dry-run` stages the files and prints what it would create, commit and push, touching nothing
 * on GitHub. Uses the `gh` CLI, which must be signed in, and git over HTTPS.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = name => {
  const index = args.indexOf(name);
  return index > -1 ? args[index + 1] : undefined;
};
const dryRun = args.includes('--dry-run');
const target = flag('--repo') ?? 'timothyrusso/expo-kit-template';
const issue = flag('--issue') ?? process.env.ISSUE;
const root = flag('--dir') ? resolve(flag('--dir')) : mkdtempSync(join(tmpdir(), 'template-sync-'));
const stage = join(root, 'stage');
const clone = join(root, 'clone');

function fail(message) {
  console.error(`template:sync: ${message}`);
  process.exit(1);
}

function run(command, commandArgs, cwd = repoRoot) {
  return execFileSync(command, commandArgs, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

function succeeds(command, commandArgs, cwd = repoRoot) {
  return spawnSync(command, commandArgs, { cwd, stdio: 'ignore' }).status === 0;
}

if (!dryRun && !/^\d+$/.test(issue ?? '')) fail('the issue number is required: --issue <n> or ISSUE=<n>');
if (!/^[\w.-]+\/[\w.-]+$/.test(target)) fail(`--repo must be owner/name, got "${target}"`);

const files = run('git', ['ls-files', '-z', 'template']).split('\0').filter(Boolean);
if (files.length === 0) fail('git tracks no file under template/');
rmSync(stage, { recursive: true, force: true });
for (const file of files) {
  const to = join(stage, file.slice('template/'.length));
  mkdirSync(dirname(to), { recursive: true });
  cpSync(join(repoRoot, file), to);
}
const sha = run('git', ['rev-parse', '--short', 'HEAD']);
console.log(`Staged ${files.length} files from template/ at ${sha} in ${stage}`);

const pkg = JSON.parse(readFileSync(join(stage, 'package.json'), 'utf8'));
const kitRange = pkg.devDependencies?.['@timothyrusso/config-presets'];
const view = spawnSync('npm', ['view', `@timothyrusso/config-presets@${kitRange}`, 'version'], { encoding: 'utf8' });
const published = kitRange !== undefined && view.status === 0 && view.stdout.trim() !== '';
if (published) {
  run('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], stage);
  console.log(`Generated package-lock.json against @timothyrusso/* ${kitRange}`);
} else {
  console.warn(
    `warning: @timothyrusso/config-presets ${kitRange} is not on npm yet, so the template has no package-lock.json ` +
      'and its npm ci fails until the kit is released and the template synced again',
  );
}

const exists = succeeds('gh', ['repo', 'view', target]);
const message = `chore(${issue ?? '<issue>'}): sync from agentic-kit ${sha}`;
if (dryRun) {
  if (!exists) {
    console.log(`Would create ${target}: gh repo create ${target} --public`);
    console.log(`Would mark it a template: gh api -X PATCH repos/${target} -f is_template=true`);
  }
  console.log(`Would replace main of ${target} with the staged files, commit "${message}" and push`);
  process.exit(0);
}

if (!exists) {
  run('gh', [
    'repo',
    'create',
    target,
    '--public',
    '--description',
    'Expo SDK 57 app wired to agentic-kit: expo-router, TanStack Query, zustand, Effect',
  ]);
  console.log(`Created ${target}`);
}
run('gh', ['api', '-X', 'PATCH', `repos/${target}`, '-f', 'is_template=true']);

rmSync(clone, { recursive: true, force: true });
run('git', ['clone', '--quiet', `https://github.com/${target}.git`, clone]);
run('git', ['checkout', '--quiet', '-B', 'main'], clone);
for (const entry of readdirSync(clone)) if (entry !== '.git') rmSync(join(clone, entry), { recursive: true });
cpSync(stage, clone, { recursive: true });
run('git', ['add', '-A'], clone);
if (run('git', ['status', '--porcelain'], clone) === '') {
  console.log(`${target} already matches template/ at ${sha}`);
  process.exit(0);
}
run('git', ['commit', '--quiet', '-m', message], clone);
run('git', ['push', '--quiet', 'origin', 'HEAD:main'], clone);
console.log(`Pushed "${message}" to ${target} main`);
