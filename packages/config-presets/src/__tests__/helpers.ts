import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The fixture app: a copy of a real two-language catalog (en, it) with the app name scrubbed. */
export const FIXTURE_APP = fileURLToPath(new URL('fixtures/app', import.meta.url));

/** The package folder, which holds the templates. */
export const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));

const created: string[] = [];

/** A fresh temporary folder, removed by `cleanup()`. */
export function tempDir(prefix = 'config-presets-'): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  created.push(dir);
  return dir;
}

/** Writes `tree` (relative path to contents) into a fresh temporary folder and returns it. */
export function writeTree(tree: Readonly<Record<string, string>>, into = tempDir()): string {
  for (const [path, contents] of Object.entries(tree)) {
    mkdirSync(dirname(join(into, path)), { recursive: true });
    writeFileSync(join(into, path), contents);
  }
  return into;
}

/** A temporary copy of the fixture app. */
export function copyFixtureApp(): string {
  const dir = tempDir();
  cpSync(FIXTURE_APP, dir, { recursive: true });
  return dir;
}

export function cleanup(): void {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
}
