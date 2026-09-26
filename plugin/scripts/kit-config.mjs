/**
 * Reads the app's `kit.config.json` for the plugin's scripts. The plugin runs inside any app, so
 * it cannot depend on `@timothyrusso/config-presets`: this is a small reader with the checks the
 * scripts need, and the full schema validation stays in the app's `npm run check`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** File name every consuming app keeps at its root. */
export const KIT_CONFIG_FILE = 'kit.config.json';

/** Thrown when the config is missing, unreadable or lacks a field a script needs. */
export class KitConfigReadError extends Error {
  name = 'KitConfigReadError';
}

/**
 * The nearest `kit.config.json` at or above `cwd`, or `null` when there is none.
 * @param {string} cwd
 * @returns {string | null}
 */
export function findKitConfig(cwd) {
  let dir = resolve(cwd);
  for (;;) {
    const candidate = join(dir, KIT_CONFIG_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Parses and checks the fields the plugin reads.
 * @param {unknown} value
 * @returns {Record<string, any>}
 */
export function checkKitConfig(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new KitConfigReadError(`${KIT_CONFIG_FILE} must hold a JSON object`);
  }
  const config = value;
  const problems = [];
  if (typeof config.projectName !== 'string' || config.projectName.length === 0) {
    problems.push('missing required field "projectName"');
  }
  const github = config.github;
  if (github !== undefined) {
    if (!Number.isInteger(github.projectNumber)) problems.push('"github.projectNumber" must be an integer');
    for (const field of ['projectId', 'statusFieldId']) {
      if (typeof github[field] !== 'string' || github[field].length === 0) {
        problems.push(`missing required field "github.${field}"`);
      }
    }
    for (const option of ['todo', 'inProgress', 'done']) {
      if (typeof github.statusOptions?.[option] !== 'string') {
        problems.push(`missing required field "github.statusOptions.${option}"`);
      }
    }
    if (github.labels !== undefined && !Array.isArray(github.labels)) problems.push('"github.labels" must be an array');
  }
  if (problems.length > 0) {
    throw new KitConfigReadError(`Invalid ${KIT_CONFIG_FILE}:\n${problems.map(p => `  - ${p}`).join('\n')}`);
  }
  return config;
}

/**
 * Reads the nearest `kit.config.json` above `cwd`.
 * @param {string} [cwd]
 * @returns {{ file: string, config: Record<string, any> }}
 */
export function readKitConfig(cwd = process.cwd()) {
  const file = findKitConfig(cwd);
  if (!file) throw new KitConfigReadError(`no ${KIT_CONFIG_FILE} found at or above ${resolve(cwd)}`);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new KitConfigReadError(`${file} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
  return { file, config: checkKitConfig(parsed) };
}
