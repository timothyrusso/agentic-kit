#!/usr/bin/env node
/**
 * Proves every kit rule still fires: `npm run arch:fixtures`.
 *
 * `__fixtures__/violations/` is a small app made of deliberate violations, with its own
 * `kit.config.json` (every lint option on) and the same dependency-cruiser and ESLint configs as
 * the template. This script
 *
 * 1. runs `npm run arch` there and requires it to fail;
 * 2. collects the rule id of every dependency-cruiser violation and every ESLint message;
 * 3. requires the ids that fired to be exactly the rules the two configs enable, and those to be
 *    exactly `EXPECTED`: a kit upgrade that adds a rule fails here until a fixture exercises it.
 *
 * The em dash fixture is written for the run and deleted after it, so no file in the repository
 * holds the character the text check forbids.
 */
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadKitConfig } from '@timothyrusso/config-presets';
import arch from '@timothyrusso/eslint-plugin-arch';
import { ESLint } from 'eslint';

const root = resolve(import.meta.dirname, '..');
const fixture = join(root, '__fixtures__', 'violations');
const dashFile = join(fixture, 'features', 'high', 'ui', 'dashes.ts');

/** Every rule id the fixture must trigger, dependency-cruiser first, then ESLint. */
const EXPECTED = [
  'domain-no-cross-feature-runtime-import',
  'domain-no-outer-layer-import',
  'domain-pure-except-effect',
  'effect-only-in-inner-layers',
  'enforce-index-boundary-features-high',
  'enforce-index-boundary-features-low',
  'enforce-index-boundary-features-peer',
  'facades-run-through-boundary',
  'no-circular',
  'no-tier-violation-features-high',
  'no-tier-violation-features-low',
  'no-tier-violation-features-peer',
  'tsx-no-cross-feature-public-api',
  'tsx-no-direct-layer-import',
  'tsx-no-runtime-domain-import',
  'usecases-no-data-import',
  'arch/no-dashes',
  'arch/no-effect-in-views',
  'arch/no-effect-run-in-facades',
  'arch/no-inline-comments',
  'arch/no-jsx-comment-text',
  'arch/no-literal-gutter',
  'arch/no-relative-imports',
  'arch/prefer-viewmodel',
  'arch/stable-row-handlers',
  'arch/viewmodel-return-shape',
  'no-restricted-imports',
  'no-restricted-syntax',
];

const failures = [];
const sorted = values => [...new Set(values)].sort();

function compare(label, actual, expected) {
  const missing = expected.filter(id => !actual.includes(id));
  const extra = actual.filter(id => !expected.includes(id));
  if (missing.length > 0) failures.push(`${label}: missing ${missing.join(', ')}`);
  if (extra.length > 0) failures.push(`${label}: unexpected ${extra.join(', ')}`);
}

writeFileSync(dashFile, `export const title = 'before ${String.fromCodePoint(0x2014)} after';\n`);
try {
  const npmArch = spawnSync('npm', ['run', '--silent', 'arch'], { cwd: fixture, encoding: 'utf8' });
  if (npmArch.status === 0) failures.push('npm run arch passed on the fixtures, it must fail');

  const depcruise = spawnSync(
    join(root, 'node_modules', '.bin', 'depcruise'),
    ['--config', '.dependency-cruiser.mjs', '--output-type', 'json', 'app', 'features'],
    { cwd: fixture, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const cruised = JSON.parse(depcruise.stdout);
  const depcruiseFired = sorted(cruised.summary.violations.map(violation => violation.rule.name));
  const depcruiseConfig = (await import(pathToFileURL(join(fixture, '.dependency-cruiser.mjs')).href)).default;
  const depcruiseEnabled = sorted(depcruiseConfig.forbidden.map(rule => rule.name));
  compare('dependency-cruiser', depcruiseFired, depcruiseEnabled);

  const results = await new ESLint({ cwd: fixture, overrideConfigFile: 'eslint.fixtures.mjs' }).lintFiles(['.']);
  const messages = results.flatMap(result => result.messages);
  for (const message of messages.filter(m => m.ruleId === null)) failures.push(`ESLint: ${message.message}`);
  const eslintFired = sorted(messages.map(message => message.ruleId).filter(id => id !== null));
  const eslintEnabled = sorted(
    arch.configs
      .recommended(loadKitConfig({ cwd: fixture }))
      .flatMap(block => Object.entries(block.rules ?? {}))
      .filter(([, setting]) => (Array.isArray(setting) ? setting[0] : setting) !== 'off')
      .map(([id]) => id),
  );
  compare('ESLint', eslintFired, eslintEnabled);
  compare('kit rules', [...depcruiseEnabled, ...eslintEnabled], EXPECTED);

  for (const id of EXPECTED) {
    const count =
      cruised.summary.violations.filter(violation => violation.rule.name === id).length +
      messages.filter(message => message.ruleId === id).length;
    console.log(`  ${String(count).padStart(2)}  ${id}`);
  }
} finally {
  rmSync(dashFile, { force: true });
}

if (failures.length > 0) {
  console.error(`\nFAIL: the fixtures do not exercise the kit rules exactly\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`\nPASS: npm run arch fails on the fixtures, and all ${EXPECTED.length} kit rules fire`);
