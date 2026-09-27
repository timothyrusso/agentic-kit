import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type CheckResult, projectFiles } from './files.js';

/**
 * NOTE: built from code points, so this file does not fail its own check and a repo-wide text
 * replace cannot rewrite the characters it looks for.
 */
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const DASHES: ReadonlyArray<readonly [string, string]> = [
  [EM, 'em dash'],
  [EN, 'en dash'],
];

const BINARY =
  /\.(png|jpe?g|gif|webp|avif|heic|ico|icns|pdf|zip|gz|tgz|jar|keystore|mp3|mp4|mov|wav|ttf|otf|woff2?|lottie)$/i;

/** Generated files nobody edits by hand. */
const GENERATED = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/;

export interface TextCheckOptions {
  readonly rootDir: string;
  readonly config: { readonly lint?: { readonly dashes?: 'forbid' | 'allow' } };
  /** Files to check, relative to `rootDir`. Defaults to every tracked and untracked, not ignored, file. */
  readonly files?: readonly string[];
  /** A commit message to check instead of files. */
  readonly message?: string;
  /** Rewrite the dashes with `replaceDashes` instead of reporting them. Ignored for a message. */
  readonly fix?: boolean;
}

/**
 * The mechanical fix: a numeric range (`8`, en dash, `12`) becomes `8-12`, and every other em or
 * en dash becomes a spaced hyphen. A colon, comma or parentheses often reads better; this only
 * guarantees the text passes.
 */
export function replaceDashes(text: string): string {
  return text
    .replace(new RegExp(`(\\d)[ \\t]*${EN}[ \\t]*(\\d)`, 'g'), '$1-$2')
    .replace(new RegExp(`[ \\t]*[${EM}${EN}][ \\t]*`, 'g'), ' - ');
}

/** Dash hits in `text`, one line per hit, prefixed with `label`. */
export function dashHits(label: string, text: string): string[] {
  if (!DASHES.some(([dash]) => text.includes(dash))) return [];
  const hits: string[] = [];
  text.split('\n').forEach((line, i) => {
    for (const [dash, name] of DASHES) {
      if (line.includes(dash)) hits.push(`${label}:${i + 1}  ${name}  ${line.trim().slice(0, 96)}`);
    }
  });
  return hits;
}

/**
 * No em dash or en dash in any file of the app, whatever its type (code, Markdown, JSON, YAML,
 * native sources), or in a commit message. Runs when `lint.dashes` is `forbid`, the default;
 * ESLint's `no-dashes` covers only JavaScript and TypeScript.
 */
export function checkText({ rootDir, config, files, message, fix = false }: TextCheckOptions): CheckResult {
  if (config.lint?.dashes === 'allow') {
    return { ok: true, summary: 'SKIP: lint.dashes is "allow" in kit.config.json', problems: [] };
  }
  const problems: string[] = [];
  const fixed: string[] = [];
  let checked = 0;
  if (message !== undefined) {
    problems.push(...dashHits('commit message', message));
    checked = 1;
  } else {
    for (const file of files ?? projectFiles(rootDir)) {
      const full = resolve(rootDir, file);
      if (BINARY.test(file) || GENERATED.test(file) || !existsSync(full) || !statSync(full).isFile()) continue;
      const text = readFileSync(full, 'utf8');
      checked += 1;
      const hits = dashHits(file, text);
      if (hits.length === 0) continue;
      if (fix) {
        writeFileSync(full, replaceDashes(text));
        fixed.push(file);
      } else problems.push(...hits);
    }
  }
  if (fixed.length > 0) {
    return { ok: true, summary: `FIXED: replaced the dashes in ${fixed.length} file(s)`, problems: fixed };
  }
  if (problems.length > 0) {
    return {
      ok: false,
      summary: `FAIL: ${problems.length} dash(es). Use a colon, comma, parentheses or a hyphen (or run with --fix).`,
      problems,
    };
  }
  return { ok: true, summary: `PASS: no em or en dashes in ${checked} file(s)`, problems };
}
