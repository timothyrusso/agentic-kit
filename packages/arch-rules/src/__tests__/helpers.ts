import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { cruise, type ICruiseResult } from 'dependency-cruiser';
import type { ArchRule } from '../paths.js';

/** File path (relative to the fixture root) to its contents. */
export type FixtureTree = Readonly<Record<string, string>>;

const created: string[] = [];

/**
 * Writes a fake app tree to a fresh temporary folder and returns its path.
 *
 * NOTE: the path is resolved through symlinks (`/var` is `/private/var` on macOS), otherwise
 * dependency-cruiser reports resolved imports relative to the real path and no rule matches.
 */
export function writeFixture(tree: FixtureTree): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'arch-rules-')));
  created.push(root);
  for (const [file, contents] of Object.entries(tree)) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
  return root;
}

/** Removes every folder `writeFixture` created. Call it from `afterAll`. */
export function removeFixtures(): void {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true });
}

/** A stub npm package, enough for dependency-cruiser to resolve it into `node_modules`. */
export function npmPackage(name: string, files: readonly string[] = []): FixtureTree {
  const entries: Record<string, string> = {
    [`node_modules/${name}/package.json`]: JSON.stringify({ name, version: '1.0.0', main: 'index.js' }),
    [`node_modules/${name}/index.js`]: 'export {};\n',
  };
  for (const file of files) entries[`node_modules/${name}/${file}`] = 'export {};\n';
  return entries;
}

export interface Violation {
  rule: string;
  from: string;
  to: string;
}

/** Cruises `folders` inside `root` with `rules` and returns every violation, sorted. */
export async function cruiseFixture(
  root: string,
  rules: readonly ArchRule[],
  folders: readonly string[] = ['.'],
): Promise<Violation[]> {
  const { output } = await cruise([...folders], {
    baseDir: root,
    validate: true,
    ruleSet: { forbidden: [...rules] },
    tsPreCompilationDeps: true,
    doNotFollow: { path: ['node_modules'] },
  });
  if (typeof output === 'string') throw new Error('Expected a structured cruise result');
  const result: ICruiseResult = output;
  return result.summary.violations
    .map(v => ({ rule: v.rule.name, from: v.from, to: v.to }))
    .sort((a, b) => `${a.rule}${a.from}${a.to}`.localeCompare(`${b.rule}${b.from}${b.to}`));
}
