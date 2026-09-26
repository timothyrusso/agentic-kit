import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/** What every check returns: `ok`, a one-line summary and one line per problem. */
export interface CheckResult {
  readonly ok: boolean;
  readonly summary: string;
  readonly problems: readonly string[];
}

/** Where an app keeps its source, from `kit.config.json`. A `KitConfig` satisfies it. */
export interface SourceLayout {
  readonly appRoot: string;
  readonly featuresRoot: string;
}

/** Folders no check descends into: dependencies, native projects and build output. */
export const SKIP_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  'ios',
  'android',
  '.expo',
  'dist',
  'coverage',
  'build',
  'web-build',
]);

/** Every file under `dir` whose name passes `accept`, skipping `SKIP_DIRS`. Missing `dir` yields none. */
export function walkFiles(dir: string, accept: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) visit(join(current, entry.name));
      } else if (entry.isFile() && accept(entry.name)) {
        out.push(join(current, entry.name));
      }
    }
  };
  visit(dir);
  return out.sort();
}

/**
 * The folders that hold app source, as absolute paths: `appRoot`, `featuresRoot` and `src`, those
 * that exist, with a folder dropped when another one already contains it.
 */
export function sourceRoots(rootDir: string, config: SourceLayout): string[] {
  const candidates = [...new Set([config.appRoot, config.featuresRoot, 'src'].map(dir => resolve(rootDir, dir)))];
  const existing = candidates.filter(dir => existsSync(dir) && statSync(dir).isDirectory());
  return existing.filter(dir => !existing.some(other => other !== dir && dir.startsWith(other + sep)));
}

/** Every `.ts` and `.tsx` file (or only `.tsx` with `tsxOnly`) under the source roots. */
export function sourceFiles(roots: readonly string[], tsxOnly = false): string[] {
  const accept = tsxOnly ? (name: string) => name.endsWith('.tsx') : (name: string) => /\.tsx?$/.test(name);
  return roots.flatMap(root => walkFiles(root, accept));
}

/**
 * Tracked and untracked, not ignored, files of the git work tree at `rootDir`, relative to it.
 * Outside a git repository it walks the folder instead, skipping `SKIP_DIRS`.
 */
export function projectFiles(rootDir: string): string[] {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\0').filter(Boolean).sort();
  } catch {
    return walkFiles(rootDir, () => true).map(file => relative(rootDir, file));
  }
}

/** `file` relative to `rootDir`, with forward slashes, for messages. */
export function display(rootDir: string, file: string): string {
  return relative(rootDir, file).split(sep).join('/');
}
