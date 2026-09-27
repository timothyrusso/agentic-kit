import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createJiti } from 'jiti';
import { type CheckResult, display, type SourceLayout, sourceFiles, sourceRoots } from './files.js';

/** The fields of `kit.config.json` the catalog checks read. A `KitConfig` satisfies it. */
export interface I18nKitConfig extends SourceLayout {
  readonly i18n?: { readonly catalogPath: string; readonly languages: readonly string[] };
}

export interface CatalogCheckOptions {
  /** App root that every path in `kit.config.json` is relative to. */
  readonly rootDir: string;
  readonly config: I18nKitConfig;
}

/** A catalog flattened to `[dotted.key, value]` pairs, in source order. */
export type FlatCatalog = ReadonlyArray<readonly [string, string]>;

const CATALOG_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];

/** The file that holds `language` inside `catalogPath`: `<catalogPath>/<language>.ts`, or `.js` or `.json`. */
export function catalogFile(rootDir: string, catalogPath: string, language: string): string | undefined {
  return CATALOG_EXTENSIONS.map(ext => resolve(rootDir, catalogPath, `${language}${ext}`)).find(file =>
    existsSync(file),
  );
}

/** Every string leaf of a nested catalog object, keyed by its dotted path. */
export function flattenCatalog(value: unknown, prefix = ''): Array<[string, string]> {
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]): Array<[string, string]> => {
    if (typeof child === 'string') return [[`${prefix}${key}`, child]];
    return flattenCatalog(child, `${prefix}${key}.`);
  });
}

/**
 * Loads one language's catalog through jiti, so TypeScript catalogs are read as the real objects
 * rather than parsed as text. The catalog is the export named after the language (`export const en`),
 * or the default export.
 */
export async function loadCatalog(file: string, language: string): Promise<FlatCatalog> {
  const jiti = createJiti(file, { moduleCache: false, fsCache: false });
  const mod = await jiti.import<Record<string, unknown>>(file);
  const catalog = mod[language] ?? mod.default;
  if (catalog === null || typeof catalog !== 'object') {
    throw new Error(`${file} exports no catalog: export it as \`${language}\` or as the default export`);
  }
  return flattenCatalog(catalog);
}

interface LoadedCatalogs {
  readonly languages: readonly string[];
  readonly catalogs: ReadonlyMap<string, FlatCatalog>;
  readonly files: readonly string[];
}

async function loadCatalogs(rootDir: string, i18n: NonNullable<I18nKitConfig['i18n']>): Promise<LoadedCatalogs> {
  const catalogs = new Map<string, FlatCatalog>();
  const files: string[] = [];
  for (const language of i18n.languages) {
    const file = catalogFile(rootDir, i18n.catalogPath, language);
    if (!file) throw new Error(`no catalog for "${language}" in ${i18n.catalogPath} (expected ${language}.ts)`);
    files.push(file);
    catalogs.set(language, await loadCatalog(file, language));
  }
  return { languages: i18n.languages, catalogs, files };
}

const skipped = (what: string): CheckResult => ({
  ok: true,
  summary: `SKIP: no i18n section in kit.config.json, so no ${what}`,
  problems: [],
});

const PLURAL = /_(one|other)$/;

function placeholders(text: string): string {
  return [...text.matchAll(/\{(\w+)\}/g)]
    .map(match => match[1])
    .sort()
    .join(',');
}

/**
 * Copy that never reached the catalog: a line of plain words inside a JSX element, with no braces
 * or quotes on it. Deliberately narrow: it cannot see a one-word label or a template literal, so
 * it is a net under the change most likely made by hand (a paragraph typed into a component).
 */
function proseOutsideCatalog(rootDir: string, files: readonly string[]): string[] {
  const problems: string[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/^\s*[A-Za-z][A-Za-z0-9 ,.'’:;()%/-]{14,}$/.test(line)) return;
      if (/[{}<>="]/.test(line)) return;
      if (/\w\(|\w\.\w/.test(line)) return;
      let j = i - 1;
      while (j >= 0 && (lines[j] ?? '').trim() === '') j -= 1;
      const prev = (lines[j] ?? '').trimEnd();
      const prevTrimmed = prev.trimStart();
      if (!prev.endsWith('>')) return;
      if (prevTrimmed.startsWith('*') || prevTrimmed.startsWith('//')) return;
      problems.push(`${display(rootDir, file)}:${i + 1}: copy outside the catalog: "${line.trim().slice(0, 60)}"`);
    });
  }
  return problems;
}

/**
 * Catalog parity, driven by `kit.config.json` `i18n`. The first language is the reference.
 *
 * - every key of every language exists in every other one;
 * - a plural key (`_one`) has its partner (`_other`) in the same language, and the reverse;
 * - `{placeholder}` slots match the reference, so no language renders a literal brace;
 * - no line of plain prose sits inside JSX under the source roots.
 */
export async function checkI18n({ rootDir, config }: CatalogCheckOptions): Promise<CheckResult> {
  if (!config.i18n) return skipped('catalog parity check');
  const { languages, catalogs } = await loadCatalogs(rootDir, config.i18n);
  const [reference, ...others] = languages;
  const maps = new Map([...catalogs].map(([language, flat]) => [language, new Map(flat)]));
  const refMap = maps.get(reference ?? '') ?? new Map<string, string>();
  const problems: string[] = [];

  for (const other of others) {
    const otherMap = maps.get(other) ?? new Map<string, string>();
    for (const key of refMap.keys()) if (!otherMap.has(key)) problems.push(`missing in ${other}: ${key}`);
    for (const key of otherMap.keys()) if (!refMap.has(key)) problems.push(`missing in ${reference}: ${key}`);
    for (const [key, value] of refMap) {
      const translated = otherMap.get(key);
      if (translated === undefined || placeholders(value) === placeholders(translated)) continue;
      problems.push(
        `${key}: placeholders differ (${reference} "${placeholders(value)}" against ${other} "${placeholders(translated)}")`,
      );
    }
  }

  for (const [language, map] of maps) {
    for (const key of map.keys()) {
      if (key.endsWith('_one') && !map.has(key.replace(PLURAL, '_other'))) {
        problems.push(`${language}: ${key} has no _other form`);
      }
      if (key.endsWith('_other') && !map.has(key.replace(PLURAL, '_one'))) {
        problems.push(`${language}: ${key} has no _one form`);
      }
    }
  }

  problems.push(...proseOutsideCatalog(rootDir, sourceFiles(sourceRoots(rootDir, config), true)));

  if (problems.length > 0) return { ok: false, summary: `FAIL: ${problems.length} i18n problem(s)`, problems };
  return {
    ok: true,
    summary: `PASS: ${refMap.size} keys, ${languages.join(' and ')} agree, and no copy outside the catalog`,
    problems,
  };
}

/**
 * Every key of the reference catalog is read somewhere under the source roots, as a quoted
 * string: `t('home.title')`, `tr('home.title')` or a module-level table of keys. A plural key
 * counts as used when its base is, because `t()` picks the form from `count`. A key built at
 * runtime from pieces reads as unused, on purpose: a key nobody can search for is a key nobody
 * can safely rename.
 */
export async function checkUnusedKeys({ rootDir, config }: CatalogCheckOptions): Promise<CheckResult> {
  if (!config.i18n) return skipped('unused key check');
  const { languages, catalogs, files } = await loadCatalogs(rootDir, config.i18n);
  const keys = (catalogs.get(languages[0] ?? '') ?? []).map(([key]) => key);
  const catalogFiles = new Set(files);
  const text = sourceFiles(sourceRoots(rootDir, config))
    .filter(file => !catalogFiles.has(file))
    .map(file => readFileSync(file, 'utf8'))
    .join('\n');

  const unused = keys.filter(key => {
    const base = key.replace(PLURAL, '');
    return !text.includes(`'${base}'`) && !text.includes(`"${base}"`) && !text.includes(`\`${base}\``);
  });
  if (unused.length > 0) {
    return {
      ok: false,
      summary: `FAIL: ${unused.length} catalog key(s) are never read. Delete them from every language in ${config.i18n.catalogPath}.`,
      problems: unused,
    };
  }
  return { ok: true, summary: `PASS: all ${keys.length} catalog keys are read`, problems: [] };
}
