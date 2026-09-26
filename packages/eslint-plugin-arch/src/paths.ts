import { isAbsolute, relative, sep } from 'node:path';

/** A file path relative to `cwd`, with forward slashes, for matching against config folders. */
export function relativePath(cwd: string, filename: string): string {
  const rel = isAbsolute(filename) ? relative(cwd, filename) : filename;
  return rel.split(sep).join('/');
}

/**
 * Turns a small glob into a regular expression that matches a relative path and everything under
 * it: `**` spans folders, `*` stays inside one segment. `packages/*` matches `packages/a/src/b.ts`.
 */
export function globToRegExp(glob: string): RegExp {
  const trimmed = glob.replace(/^\.\//, '').replace(/\/+$/, '');
  let source = '';
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed.charAt(i);
    if (ch === '*' && trimmed.charAt(i + 1) === '*') {
      source += '.*';
      i += 1;
    } else if (ch === '*') {
      source += '[^/]*';
    } else {
      source += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}(?:/|$)`);
}

/** Whether `path` sits in one of the folders or files the globs name. */
export function matchesAny(path: string, globs: readonly string[]): boolean {
  return globs.some(glob => globToRegExp(glob).test(path));
}

/** Whether a file is a test, which the ViewModel rules skip. */
export function isTestFile(filename: string): boolean {
  return filename.includes('.test.') || filename.includes('.spec.');
}
