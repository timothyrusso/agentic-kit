#!/usr/bin/env node
/**
 * Lockstep release: every package, the plugin manifest and the marketplace entry get the same
 * version, and `template/package.json` depends on it (`^<version>`), then one commit and one tag.
 *
 *   npm run release -- <version> --issue <n>   (or ISSUE=<n> npm run release -- <version>)
 *   npm run release -- <version> --issue <n> --dry-run
 *   node scripts/release.js --verify <version>  fail unless every manifest is at <version> (CI)
 *
 * The commit is `chore(<issue>): release <version>` and the tag `v<version>`. Pushing is left to
 * the human: `git push --follow-tags`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const SCOPE = '@timothyrusso/';
const PLUGIN_MANIFESTS = ['plugin/plugin.json', 'plugin/.claude-plugin/plugin.json'];
const MARKETPLACE_MANIFESTS = ['marketplace.json', '.claude-plugin/marketplace.json'];
const TEMPLATE_MANIFEST = 'template/package.json';

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function packageManifests() {
  return readdirSync('packages', { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join('packages', entry.name, 'package.json'))
    .filter(existsSync);
}

/** Every versioned manifest with a getter and setter for its version fields. */
function manifests() {
  const list = packageManifests().map(file => ({
    file,
    versions: json => [json.version],
    bump: (json, version) => {
      json.version = version;
      for (const field of ['dependencies', 'peerDependencies', 'devDependencies']) {
        for (const name of Object.keys(json[field] ?? {})) {
          if (name.startsWith(SCOPE)) json[field][name] = version;
        }
      }
    },
  }));
  for (const file of PLUGIN_MANIFESTS.filter(existsSync)) {
    list.push({
      file,
      versions: json => [json.version],
      bump: (json, version) => {
        json.version = version;
      },
    });
  }
  for (const file of MARKETPLACE_MANIFESTS.filter(existsSync)) {
    list.push({
      file,
      versions: json => (json.plugins ?? []).filter(p => 'version' in p).map(p => p.version),
      bump: (json, version) => {
        for (const plugin of json.plugins ?? []) if ('version' in plugin) plugin.version = version;
      },
    });
  }
  if (existsSync(TEMPLATE_MANIFEST)) {
    const kitDeps = json =>
      ['dependencies', 'devDependencies'].flatMap(field =>
        Object.keys(json[field] ?? {})
          .filter(name => name.startsWith(SCOPE))
          .map(name => [field, name]),
      );
    list.push({
      file: TEMPLATE_MANIFEST,
      versions: json => kitDeps(json).map(([field, name]) => json[field][name].replace(/^\^/, '')),
      bump: (json, version) => {
        for (const [field, name] of kitDeps(json)) json[field][name] = `^${version}`;
      },
    });
  }
  return list;
}

function parseArgs(argv) {
  const options = { version: undefined, issue: process.env.ISSUE, dryRun: false, verify: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--verify') options.verify = true;
    else if (arg === '--issue') options.issue = argv[++i];
    else if (arg.startsWith('--issue=')) options.issue = arg.slice('--issue='.length);
    else if (!options.version) options.version = arg.replace(/^v/, '');
    else fail(`unexpected argument "${arg}"`);
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
if (!options.version || !SEMVER.test(options.version)) fail('usage: npm run release -- <x.y.z> --issue <n>');

if (options.verify) {
  const wrong = manifests().flatMap(({ file, versions }) =>
    versions(readJson(file))
      .filter(v => v !== options.version)
      .map(v => `${file} is at ${v}`),
  );
  if (wrong.length > 0) fail(`versions do not match ${options.version}:\n  ${wrong.join('\n  ')}`);
  console.log(`All manifests are at ${options.version}`);
  process.exit(0);
}

if (!options.issue || !/^\d+$/.test(options.issue)) fail('the issue number is required: --issue <n> or ISSUE=<n>');
const tag = `v${options.version}`;
const message = `chore(${options.issue}): release ${options.version}`;
if (git('tag', '--list', tag)) fail(`tag ${tag} already exists`);
if (!options.dryRun && git('status', '--porcelain')) fail('the working tree is not clean');

const touched = [];
for (const { file, bump } of manifests()) {
  const json = readJson(file);
  bump(json, options.version);
  touched.push(file);
  if (!options.dryRun) writeJson(file, json);
}

if (options.dryRun) {
  console.log(`Would bump to ${options.version}:\n  ${touched.join('\n  ')}`);
  console.log(`Would commit "${message}" and tag ${tag}`);
  process.exit(0);
}

execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts'], { stdio: 'inherit' });
execFileSync('npx', ['biome', 'format', '--write', '--no-errors-on-unmatched', ...touched], { stdio: 'inherit' });
execFileSync('git', ['add', ...touched, 'package-lock.json'], { stdio: 'inherit' });
execFileSync('git', ['commit', '-m', message], { stdio: 'inherit' });
execFileSync('git', ['tag', '-a', tag, '-m', message], { stdio: 'inherit' });
console.log(`Released ${options.version}: commit "${message}", tag ${tag}. Push with \`git push --follow-tags\`.`);
