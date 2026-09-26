import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Ajv, type ErrorObject } from 'ajv';
import schema from './kitConfig.schema.json' with { type: 'json' };

/** File name every consuming app keeps at its root. */
export const KIT_CONFIG_FILE = 'kit.config.json';

export type QaTarget = 'mobile' | 'web';

/**
 * A validated `kit.config.json` with the schema defaults applied (`featuresRoot`, `appRoot` and
 * the defaults inside any section that is present).
 */
export interface KitConfig {
  projectName: string;
  featuresRoot: 'features' | 'src/features';
  appRoot: string;
  github?: {
    projectNumber: number;
    projectId: string;
    statusFieldId: string;
    statusOptions: { todo: string; inProgress: string; done: string };
    labels: string[];
  };
  qa?: {
    targets: QaTarget[];
    simulator?: string;
    metroPort?: number;
  };
  lint?: {
    allowedHooksInViews: string[];
    dashes: 'forbid' | 'allow';
    layoutTokens?: { gutterToken: string; spacingImport: string; allowlistFile: string };
    singleSpinner: boolean;
  };
  i18n?: {
    catalogPath: string;
    languages: string[];
  };
}

/** Thrown when `kit.config.json` is missing, unreadable or fails the schema. */
export class KitConfigError extends Error {
  override readonly name = 'KitConfigError';
  readonly issues: readonly string[];

  constructor(message: string, issues: readonly string[] = []) {
    super(issues.length > 0 ? `${message}\n${issues.map(issue => `  - ${issue}`).join('\n')}` : message);
    this.issues = issues;
  }
}

const ajv = new Ajv({ allErrors: true, useDefaults: true, strict: true });
const validate = ajv.compile<KitConfig>(schema);

function fieldPath(instancePath: string, child?: string): string {
  const parts = instancePath.split('/').filter(Boolean);
  if (child !== undefined) parts.push(child);
  return parts.join('.');
}

function describe(error: ErrorObject): string {
  const field = fieldPath(error.instancePath);
  switch (error.keyword) {
    case 'required':
      return `missing required field "${fieldPath(error.instancePath, String(error.params.missingProperty))}"`;
    case 'additionalProperties':
      return `unknown field "${fieldPath(error.instancePath, String(error.params.additionalProperty))}"`;
    case 'enum':
      return `"${field}" must be one of: ${(error.params.allowedValues as unknown[]).join(', ')}`;
    case 'type':
      return field ? `"${field}" must be ${error.params.type}` : `the config must be ${error.params.type}`;
    default:
      return `"${field}" ${error.message ?? 'is invalid'}`;
  }
}

/**
 * Validates an already parsed config against `kit.config.schema.json` and applies its defaults.
 * `source` names the file in the error message.
 */
export function parseKitConfig(value: unknown, source: string = KIT_CONFIG_FILE): KitConfig {
  const copy: unknown = structuredClone(value);
  if (validate(copy)) return copy;
  const issues = [...new Set((validate.errors ?? []).map(describe))];
  throw new KitConfigError(`Invalid ${source}:`, issues);
}

/** Walks up from `cwd` to the nearest `kit.config.json`, or returns `undefined`. */
export function findKitConfig(cwd: string = process.cwd()): string | undefined {
  let dir = resolve(cwd);
  for (;;) {
    const candidate = join(dir, KIT_CONFIG_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export interface LoadKitConfigOptions {
  /** Explicit file to read. When absent the nearest `kit.config.json` above `cwd` is used. */
  path?: string;
  cwd?: string;
}

/** Reads, parses and validates `kit.config.json`. Throws `KitConfigError` with every problem. */
export function loadKitConfig(options: LoadKitConfigOptions = {}): KitConfig {
  const file = options.path ? resolve(options.cwd ?? process.cwd(), options.path) : findKitConfig(options.cwd);
  if (!file) throw new KitConfigError(`No ${KIT_CONFIG_FILE} found in ${options.cwd ?? process.cwd()} or above it.`);
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (cause) {
    throw new KitConfigError(`Cannot read ${file}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (cause) {
    throw new KitConfigError(`${file} is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  return parseKitConfig(json, file);
}
