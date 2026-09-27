/** The slice of an app's `package.json` that `init` reads and writes. */
export interface PackageJson {
  name?: string;
  type?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [field: string]: unknown;
}

/**
 * The scripts `init` adds. `check` runs every gate; the catalog checks pass with a SKIP note until
 * `kit.config.json` gains an `i18n` section, and `check:arch` until `featuresRoot` or `appRoot`
 * exists, so the script never needs editing as the app grows.
 */
export const APP_SCRIPTS: Readonly<Record<string, string>> = {
  lint: 'biome check . && eslint .',
  format: 'biome check --write .',
  typecheck: 'tsc --noEmit',
  'check:text': 'config-presets check-text',
  'check:arch': 'config-presets check-deps',
  'check:i18n': 'config-presets check-i18n',
  'check:unused-keys': 'config-presets check-unused-keys',
  'check:hooks': 'config-presets check-hooks',
  test: 'jest --passWithNoTests',
  check:
    'npm run lint && npm run typecheck && npm run check:text && npm run check:arch && npm run check:i18n && npm run check:unused-keys && npm run check:hooks && npm run test',
};

/** The `prepare` step that installs the git hooks. */
export const PREPARE = 'lefthook install';

/**
 * Tool versions `init` adds when the app has none. `typescript` is held at 5.9 because
 * dependency-cruiser 18 does not support TypeScript 7; an app already on 5.x or 6.x keeps its own.
 */
export const TOOL_VERSIONS: Readonly<Record<string, string>> = {
  '@biomejs/biome': '^2.5.14',
  '@commitlint/cli': '^21.2.3',
  '@commitlint/config-conventional': '^21.2.3',
  'dependency-cruiser': '^18.4.0',
  eslint: '^10.11.0',
  lefthook: '^2.1.14',
  typescript: '~5.9.3',
};

/** The kit's own packages, installed at the same (lockstep) version as this one. */
export const KIT_PACKAGES = [
  '@timothyrusso/config-presets',
  '@timothyrusso/eslint-plugin-arch',
  '@timothyrusso/arch-rules',
] as const;

/** Installed with `npx expo install`, so their versions match the app's Expo SDK. */
export const EXPO_TEST_PACKAGES = ['jest-expo', 'jest', '@types/jest'] as const;

export interface PackageJsonPlan {
  readonly packageJson: PackageJson;
  readonly scriptsAdded: readonly string[];
  /** Scripts the app already had with a different command, left alone (without `force`). */
  readonly scriptsKept: readonly string[];
  readonly devDependenciesAdded: readonly string[];
  /** Expo test packages the app is missing. */
  readonly expoTestPackagesMissing: readonly string[];
  readonly warnings: readonly string[];
}

const has = (pkg: PackageJson, name: string) =>
  pkg.dependencies?.[name] !== undefined || pkg.devDependencies?.[name] !== undefined;

/** Merges the kit's scripts and devDependencies into `pkg`, without mutating it. */
export function planPackageJson(pkg: PackageJson, kitVersion: string, force: boolean): PackageJsonPlan {
  const scripts = { ...(pkg.scripts ?? {}) };
  const scriptsAdded: string[] = [];
  const scriptsKept: string[] = [];
  const warnings: string[] = [];

  for (const [name, command] of Object.entries(APP_SCRIPTS)) {
    const current = scripts[name];
    if (current === command) continue;
    if (current !== undefined && !force) {
      scriptsKept.push(name);
      continue;
    }
    scripts[name] = command;
    scriptsAdded.push(name);
  }
  const prepare = scripts.prepare;
  if (prepare === undefined) {
    scripts.prepare = PREPARE;
    scriptsAdded.push('prepare');
  } else if (!prepare.includes('lefthook install')) {
    scripts.prepare = `${prepare} && ${PREPARE}`;
    scriptsAdded.push('prepare');
  }

  const devDependencies = { ...(pkg.devDependencies ?? {}) };
  const devDependenciesAdded: string[] = [];
  const wanted: Record<string, string> = {
    ...Object.fromEntries(KIT_PACKAGES.map(name => [name, `^${kitVersion}`])),
    ...TOOL_VERSIONS,
  };
  for (const [name, range] of Object.entries(wanted)) {
    if (has(pkg, name)) continue;
    devDependencies[name] = range;
    devDependenciesAdded.push(name);
  }
  const ts = pkg.devDependencies?.typescript ?? pkg.dependencies?.typescript;
  if (ts !== undefined && /^\D*([7-9]|\d{2,})\./.test(ts)) {
    warnings.push(`typescript ${ts}: dependency-cruiser 18 does not support TypeScript 7, use ~5.9.3 or 6.x`);
  }
  if (!has(pkg, 'expo')) {
    warnings.push('expo is not a dependency: the Jest preset extends jest-expo, install it before running tests');
  }

  const sortedDevDependencies = Object.fromEntries(
    Object.entries(devDependencies).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  return {
    packageJson: { ...pkg, scripts, devDependencies: sortedDevDependencies },
    scriptsAdded,
    scriptsKept,
    devDependenciesAdded,
    expoTestPackagesMissing: EXPO_TEST_PACKAGES.filter(name => !has(pkg, name)),
    warnings,
  };
}
