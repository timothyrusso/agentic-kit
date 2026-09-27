import { readFileSync } from 'node:fs';
import { type CheckResult, display, sourceFiles, sourceRoots } from './files.js';
import type { CatalogCheckOptions } from './i18n.js';

/** A class component cannot call a hook, so it may use `tr()`. */
const CLASS_COMPONENT = /\bextends\s+(React\.)?(Pure)?Component\b/;

/** The index of the bracket that closes the one at `open`, or the end of `src`. */
function closingBracket(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return src.length - 1;
}

/** Problems in one file's source. `file` is only used in the messages. */
export function staleLanguageProblems(file: string, src: string): string[] {
  const problems: string[] = [];

  for (const match of src.matchAll(/use(?:Memo|Callback)\(/g)) {
    const start = match.index;
    const call = src.slice(start, closingBracket(src, start + match[0].length - 1) + 1);
    const open = call.lastIndexOf('[');
    const close = call.lastIndexOf(']');
    if (open < 0 || close < open) continue;
    const body = call.slice(0, open);
    const deps = call.slice(open, close + 1);
    if (!/\bt\(/.test(body) || /\bt\b/.test(deps)) continue;
    const line = src.slice(0, start).split('\n').length;
    problems.push(`${file}:${line}: hook calls t() but does not depend on it, so it keeps one language`);
  }

  if (/\btr\(/.test(src) && !CLASS_COMPONENT.test(src) && /memo\(function/.test(src) && !/useT\(\)/.test(src)) {
    const line = src.split('\n').findIndex(l => /\btr\(/.test(l) && !/^\s*(\*|\/\/)/.test(l)) + 1;
    problems.push(`${file}:${line}: memoised component calls tr(), which does not subscribe: use useT()`);
  }
  return problems;
}

/**
 * Two ways translated copy silently freezes, for apps whose translator is `t()` from a `useT()`
 * hook and `tr()` outside React:
 *
 * 1. A `useMemo` or `useCallback` that calls `t()` without listing it as a dependency keeps the
 *    translator it was created with, so it answers in the old language after a switch.
 * 2. A memoised component that calls `tr()` (which reads the language but does not subscribe)
 *    skips the re-render and keeps the words it first drew. Class components are exempt.
 */
export function checkHooks({ rootDir, config }: CatalogCheckOptions): CheckResult {
  if (!config.i18n) {
    return { ok: true, summary: 'SKIP: no i18n section in kit.config.json, so no stale language check', problems: [] };
  }
  const problems = sourceFiles(sourceRoots(rootDir, config)).flatMap(file =>
    staleLanguageProblems(display(rootDir, file), readFileSync(file, 'utf8')),
  );
  if (problems.length > 0) {
    return { ok: false, summary: `FAIL: ${problems.length} stale-language problem(s)`, problems };
  }
  return { ok: true, summary: 'PASS: no hook or memoised component holds a stale language', problems };
}
