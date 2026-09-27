#!/usr/bin/env node
/**
 * End-to-end smoke test of `@timothyrusso/config-presets`, run locally and by `presets-smoke.yml`.
 *
 *   node scripts/smoke-presets.js [--dir <folder>]
 *
 * 1. Packs the kit's packages (unpublished at 0.0.0, so the app installs the tarballs).
 * 2. Creates a fresh Expo app with create-expo-app (blank-typescript) and installs the tarballs.
 * 3. Runs `config-presets init --yes`, which installs the tools, jest-expo and the git hooks.
 * 4. Runs every `run:` step of the `check` job of the app's own `.github/workflows/pr-checks.yml`
 *    (the file `init` copied), as a push event would: `npm ci`, the architecture check,
 *    `npm run check` and `npx expo export --platform ios`. `uses:` steps (checkout, setup-node,
 *    the PR comment) and PR-only steps are skipped and listed.
 * 5. Adds a translated catalog and a feature with a tier: `npm run check` must still pass, and must
 *    fail on a key removed from `it.ts` and on a Tier 0 feature importing a Tier 1 one.
 * 6. Commits through the installed lefthook hooks: `chore(1): ...` must pass and a message without
 *    an issue number must be rejected.
 *
 * The folder defaults to a fresh one under the system temp dir (`RUNNER_TEMP` in CI).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';

const CREATE_EXPO_APP = 'create-expo-app@5.0.0';
const TEMPLATE = 'blank-typescript@sdk-57';
const PACKAGES = ['@timothyrusso/config-presets', '@timothyrusso/eslint-plugin-arch', '@timothyrusso/arch-rules'];
const EVENT = 'push';

const repo = resolve(import.meta.dirname, '..');
const dirFlag = process.argv.indexOf('--dir');
const root =
  dirFlag > -1
    ? resolve(process.argv[dirFlag + 1])
    : mkdtempSync(join(process.env.RUNNER_TEMP ?? tmpdir(), 'presets-'));
const kitDir = join(root, 'kit');
const appDir = join(root, 'app');
const runnerTemp = join(root, 'runner-temp');
mkdirSync(kitDir, { recursive: true });
mkdirSync(runnerTemp, { recursive: true });

function sh(command, args, cwd, env = {}) {
  console.log(`\n$ ${[command, ...args].join(' ')}   (in ${cwd})`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
  return result.status ?? 1;
}

function must(command, args, cwd, env) {
  const code = sh(command, args, cwd, env);
  if (code !== 0) fail(`${command} ${args.join(' ')} exited with ${code}`);
}

function fail(message) {
  console.error(`\nSMOKE FAIL: ${message}`);
  process.exit(1);
}

/** Evaluates the small subset of GitHub `if:` expressions the template uses, for a non-PR event. */
function stepRuns(condition) {
  if (condition === undefined) return true;
  const terms = String(condition)
    .split('&&')
    .map(term => term.trim());
  const values = terms.map(term => {
    if (term === 'always()') return true;
    const match = /^github\.event_name\s*(==|!=)\s*'([^']+)'$/.exec(term);
    if (match) return match[1] === '==' ? EVENT === match[2] : EVENT !== match[2];
    return undefined;
  });
  if (values.includes(false)) return false;
  if (values.includes(undefined)) fail(`unsupported step condition: ${condition}`);
  return true;
}

must('npm', ['run', 'build'], repo);
must('npm', ['pack', ...PACKAGES.flatMap(name => ['-w', name]), '--pack-destination', kitDir], repo);
const tarballs = readdirSync(kitDir)
  .filter(file => file.endsWith('.tgz'))
  .map(file => join(kitDir, file));
if (tarballs.length !== PACKAGES.length) fail(`expected ${PACKAGES.length} tarballs in ${kitDir}`);

must('npx', ['--yes', CREATE_EXPO_APP, 'app', '--template', TEMPLATE, '--no-install'], root);
must('npm', ['install', '--no-audit', '--no-fund', '--save-dev', ...tarballs], appDir);
must('npx', ['--no-install', 'config-presets', 'init', '--yes'], appDir);
const installed = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'));
for (const name of ['jest-expo', 'jest', '@types/jest', '@biomejs/biome', 'dependency-cruiser']) {
  if (!installed.devDependencies?.[name]) fail(`init did not add ${name} to devDependencies`);
}

const workflow = parse(readFileSync(join(appDir, '.github/workflows/pr-checks.yml'), 'utf8'));
const skipped = [];
const outputFile = join(runnerTemp, 'github-output');
writeFileSync(outputFile, '');
for (const step of workflow.jobs.check.steps) {
  const name = step.name ?? step.run ?? step.uses;
  if (step.uses || !stepRuns(step.if)) {
    skipped.push(name);
    continue;
  }
  if (/\$\{\{/.test(step.run)) fail(`step "${name}" needs a GitHub expression the smoke cannot provide`);
  must('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', step.run], appDir, {
    CI: 'true',
    GITHUB_EVENT_NAME: EVENT,
    GITHUB_OUTPUT: outputFile,
    RUNNER_TEMP: runnerTemp,
  });
}
console.log(`\nSkipped pr-checks.yml steps (uses: or PR only): ${skipped.join(' | ')}`);

/** Writes files into the app, relative to its root. */
function write(files) {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(appDir, file)), { recursive: true });
    writeFileSync(join(appDir, file), text);
  }
}

function mustFail(script, expected) {
  const result = spawnSync('npm', ['run', '--silent', script], { cwd: appDir, encoding: 'utf8' });
  const output = `${result.stdout}${result.stderr}`;
  if (result.status === 0 || !output.includes(expected)) {
    fail(`npm run ${script} should fail with "${expected}", got ${result.status}:\n${output}`);
  }
  console.log(`\nnpm run ${script} failed as expected: ${expected}`);
}

const kitConfigFile = join(appDir, 'kit.config.json');
const kitConfig = JSON.parse(readFileSync(kitConfigFile, 'utf8'));
writeFileSync(
  kitConfigFile,
  `${JSON.stringify({ ...kitConfig, i18n: { catalogPath: 'i18n', languages: ['en', 'it'] } }, null, 2)}\n`,
);
write({
  'i18n/en.ts': "export const en = {\n  greeting: { hello: 'Hello' },\n};\n",
  'i18n/it.ts': "export const it = {\n  greeting: { hello: 'Ciao' },\n};\n",
  'features/greeting/index.ts':
    "export const FEATURE_TIER = 1;\n\nexport { greetingKey } from '@/features/greeting/domain/greeting';\n",
  'features/greeting/domain/greeting.ts': "export const greetingKey = 'greeting.hello';\n",
});
must('npx', ['--no-install', 'biome', 'format', '--write', 'kit.config.json'], appDir);
must('npm', ['run', 'check'], appDir);

write({ 'i18n/it.ts': 'export const it = {\n  greeting: {},\n};\n' });
mustFail('check:i18n', 'missing in it: greeting.hello');
write({ 'i18n/it.ts': "export const it = {\n  greeting: { hello: 'Ciao' },\n};\n" });

write({
  'features/base/index.ts': "export const FEATURE_TIER = 0;\n\nexport { greetingKey } from '@/features/greeting';\n",
});
mustFail('check:arch', 'features/base/index.ts');
rmSync(join(appDir, 'features/base'), { recursive: true });
must('npm', ['run', 'check'], appDir);

const git = ['-c', 'user.name=Smoke', '-c', 'user.email=smoke@example.com'];
must('git', ['add', '-A'], appDir);
must('git', [...git, 'commit', '-m', 'chore(1): adopt the agentic kit presets'], appDir);
if (sh('git', [...git, 'commit', '--allow-empty', '-m', 'adopt the presets'], appDir) === 0) {
  fail('the commit-msg hook accepted a message without an issue number');
}
const log = execFileSync('git', ['log', '--format=%s'], { cwd: appDir, encoding: 'utf8' });
if (!log.startsWith('chore(1): adopt the agentic kit presets\n')) fail(`unexpected git log:\n${log}`);

console.log(`\nSMOKE PASS: ${appDir}`);
