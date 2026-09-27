#!/usr/bin/env node
/**
 * Verifies `template/` against the kit's current packages, run locally and by the `template` job
 * of `ci.yml`.
 *
 *   node scripts/verify-template.js [--dir <folder>]
 *
 * The template depends on the published `@timothyrusso/*` packages. Until a version is on npm, and
 * to test the packages a change is about to publish, this script
 *
 * 1. builds and packs the four kit packages;
 * 2. copies `template/` (the files git tracks or would track) to a fresh folder and points its four
 *    `@timothyrusso/*` dependencies at the tarballs;
 * 3. runs `git init` and `npm install` (which installs the git hooks, as a real clone would);
 * 4. runs `npm run check`, `npm test`, `npm run arch` (must pass on the app), `npm run arch:fixtures`
 *    (the fixtures must fail with exactly the kit's rules) and `npx expo export --platform ios`.
 *
 * It never starts Metro. The folder defaults to a fresh one under the system temp dir (`RUNNER_TEMP`
 * in CI).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const PACKAGES = [
  '@timothyrusso/config-presets',
  '@timothyrusso/eslint-plugin-arch',
  '@timothyrusso/arch-rules',
  '@timothyrusso/effect-core',
];

const repo = resolve(import.meta.dirname, '..');
const dirFlag = process.argv.indexOf('--dir');
const root =
  dirFlag > -1
    ? resolve(process.argv[dirFlag + 1])
    : mkdtempSync(join(process.env.RUNNER_TEMP ?? tmpdir(), 'template-'));
const kitDir = join(root, 'kit');
const appDir = join(root, 'app');
mkdirSync(kitDir, { recursive: true });

function must(command, args, cwd, env = {}) {
  console.log(`\n$ ${[command, ...args].join(' ')}   (in ${cwd})`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.status !== 0) fail(`${command} ${args.join(' ')} exited with ${result.status ?? result.signal}`);
}

function fail(message) {
  console.error(`\nTEMPLATE FAIL: ${message}`);
  process.exit(1);
}

must('npm', ['run', 'build'], repo);
must('npm', ['pack', ...PACKAGES.flatMap(name => ['-w', name]), '--pack-destination', kitDir], repo);
const tarballs = new Map(
  readdirSync(kitDir)
    .filter(file => file.endsWith('.tgz'))
    .map(file => [file, join(kitDir, file)]),
);

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', 'template'], {
  cwd: repo,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
if (files.length === 0) fail('template/ has no files');
for (const file of files) {
  const target = join(appDir, file.slice('template/'.length));
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(repo, file), target);
}

const pkgFile = join(appDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
for (const name of PACKAGES) {
  const field = pkg.dependencies?.[name] ? 'dependencies' : 'devDependencies';
  if (!pkg[field]?.[name]) fail(`template/package.json does not depend on ${name}`);
  const tarball = [...tarballs].find(([file]) => file.startsWith(`${name.slice(1).replace('/', '-')}-`));
  if (!tarball) fail(`no tarball for ${name} in ${kitDir}`);
  pkg[field][name] = `file:${tarball[1]}`;
}
writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

must('git', ['init', '-q'], appDir);
must('npm', ['install', '--no-audit', '--no-fund'], appDir);
must('npm', ['run', 'check'], appDir);
must('npm', ['test'], appDir);
must('npm', ['run', 'arch'], appDir);
must('npm', ['run', 'arch:fixtures'], appDir);
must('npx', ['expo', 'export', '--platform', 'ios', '--output-dir', join(root, 'expo-export')], appDir, {
  CI: 'true',
});

console.log(`\nTEMPLATE PASS: ${appDir}`);
