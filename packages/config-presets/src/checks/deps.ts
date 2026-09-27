import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SourceLayout } from './files.js';

/** Config files `check-deps` looks for, in order, when no `--config` is given. */
export const DEPCRUISE_CONFIG_FILES = [
  '.dependency-cruiser.mjs',
  '.dependency-cruiser.js',
  '.dependency-cruiser.cjs',
  '.dependency-cruiser.json',
] as const;

export interface DepsCheckOptions {
  readonly rootDir: string;
  readonly config: SourceLayout;
  readonly configFile?: string;
}

export interface DepsPlan {
  /** The folders to cruise, relative to `rootDir`: `featuresRoot` and `appRoot`, those that exist. */
  readonly roots: readonly string[];
  readonly configFile: string | undefined;
}

/** What `check-deps` would run, without running it. */
export function planDepsCheck({ rootDir, config, configFile }: DepsCheckOptions): DepsPlan {
  const roots = [...new Set([config.featuresRoot, config.appRoot])].filter(dir => {
    const full = resolve(rootDir, dir);
    return existsSync(full) && statSync(full).isDirectory();
  });
  const file = configFile ?? DEPCRUISE_CONFIG_FILES.find(name => existsSync(resolve(rootDir, name)));
  return { roots, configFile: file };
}

/**
 * Runs the app's own dependency-cruiser over `featuresRoot` and `appRoot` with the generated
 * architecture rules. Passes with a note while neither folder exists yet (a fresh app), so the
 * check can sit in `npm run check` from day one. Returns the exit code; output goes to the terminal.
 */
export function runDepsCheck(options: DepsCheckOptions, write: (line: string) => void): number {
  const { roots, configFile } = planDepsCheck(options);
  if (!configFile) {
    write(`FAIL: no dependency-cruiser config (${DEPCRUISE_CONFIG_FILES.join(', ')}). Run config-presets init.`);
    return 1;
  }
  if (roots.length === 0) {
    write(`PASS: no ${options.config.featuresRoot}/ or ${options.config.appRoot}/ folder yet, nothing to cruise`);
    return 0;
  }
  const result = spawnSync('npx', ['--no-install', 'depcruise', '--config', configFile, ...roots], {
    cwd: options.rootDir,
    stdio: 'inherit',
  });
  if (result.error) {
    write(`FAIL: could not run dependency-cruiser: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}
