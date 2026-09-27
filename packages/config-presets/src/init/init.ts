import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { checkText } from '../checks/text.js';
import { KIT_CONFIG_FILE, parseKitConfig } from '../kitConfig.js';
import { type ClaudeSettings, mergeClaudeSettings } from './claudeSettings.js';
import { type PackageJson, planPackageJson } from './packageJson.js';

type FeaturesRoot = 'features' | 'src/features';

/** Answers `init` can take as flags instead of prompts. */
export interface InitFlags {
  readonly projectName?: string;
  readonly featuresRoot?: string;
  readonly appRoot?: string;
  /** Catalog folder; an empty string means no catalog. */
  readonly i18n?: string;
  readonly languages?: readonly string[];
  readonly dashes?: string;
}

export interface InitOptions {
  /** The app root, where `package.json` lives. */
  readonly cwd: string;
  /** This package's folder, which holds the templates. */
  readonly packageRoot: string;
  /** Accept the default for every question that no flag answers. */
  readonly yes: boolean;
  /** Overwrite files and scripts the app already has. */
  readonly force: boolean;
  /** Run `npm install`, `npx expo install` for the test packages, Biome and `lefthook install`. */
  readonly install: boolean;
  readonly flags: InitFlags;
  /** Asks one question. Absent when stdin is not a terminal: the defaults are used. */
  readonly ask?: (question: string, fallback: string) => Promise<string>;
  /** Runs a command in `cwd` and returns its exit code. Defaults to `spawnSync` with inherited output. */
  readonly run?: (command: string, args: readonly string[]) => number;
  readonly write: (line: string) => void;
}

/** The `kit.config.json` fields `init` writes. */
interface Answers {
  projectName: string;
  featuresRoot: FeaturesRoot;
  appRoot: string;
  i18n?: { catalogPath: string; languages: string[] };
  dashes: 'forbid' | 'allow';
}

const TSCONFIG_PRESET = '@timothyrusso/config-presets/tsconfig/expo.json';
const SCHEMA_PATH = './node_modules/@timothyrusso/config-presets/dist/kitConfig.schema.json';

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

function defaults(cwd: string, pkg: PackageJson, existing: Record<string, unknown> | undefined): Answers {
  const srcLayout = existsSync(join(cwd, 'src', 'app'));
  const i18n = existing?.i18n as Answers['i18n'] | undefined;
  const lint = existing?.lint as { dashes?: 'forbid' | 'allow' } | undefined;
  return {
    projectName: (existing?.projectName as string | undefined) ?? pkg.name ?? 'app',
    featuresRoot: (existing?.featuresRoot as FeaturesRoot | undefined) ?? (srcLayout ? 'src/features' : 'features'),
    appRoot: (existing?.appRoot as string | undefined) ?? (srcLayout ? 'src/app' : 'app'),
    ...(i18n ? { i18n } : {}),
    dashes: lint?.dashes ?? 'forbid',
  };
}

const splitList = (value: string) =>
  value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);

async function resolveAnswers(options: InitOptions, base: Answers): Promise<Answers> {
  const { flags, yes } = options;
  const ask = yes ? undefined : options.ask;
  const answer = async (question: string, flag: string | undefined, fallback: string) =>
    flag ?? (ask ? (await ask(question, fallback)).trim() || fallback : fallback);

  const projectName = await answer('Project name', flags.projectName, base.projectName);
  const featuresRoot = await answer(
    'Features folder (features or src/features)',
    flags.featuresRoot,
    base.featuresRoot,
  );
  const appRoot = await answer('expo-router app folder', flags.appRoot, base.appRoot);
  const catalogPath = await answer(
    'Translation catalog folder (none for no catalog)',
    flags.i18n,
    base.i18n?.catalogPath ?? 'none',
  );
  const hasCatalog = catalogPath !== '' && catalogPath !== 'none';
  const languages = hasCatalog
    ? splitList(
        await answer(
          'Catalog languages, reference first (comma separated)',
          flags.languages?.join(','),
          base.i18n?.languages.join(',') ?? 'en',
        ),
      )
    : [];
  const dashes = await answer('Em and en dashes (forbid or allow)', flags.dashes, base.dashes);
  return {
    projectName,
    featuresRoot: featuresRoot as FeaturesRoot,
    appRoot,
    ...(hasCatalog ? { i18n: { catalogPath, languages } } : {}),
    dashes: dashes as Answers['dashes'],
  };
}

function kitConfigJson(answers: Answers): Record<string, unknown> {
  const config = {
    $schema: SCHEMA_PATH,
    projectName: answers.projectName,
    featuresRoot: answers.featuresRoot,
    appRoot: answers.appRoot,
    lint: { dashes: answers.dashes },
    ...(answers.i18n ? { i18n: answers.i18n } : {}),
  };
  parseKitConfig(config);
  return config;
}

/** Where the `@/` alias points: `src` for a `src/features` layout, the app root otherwise. */
function aliasRoot(featuresRoot: FeaturesRoot): string {
  return featuresRoot === 'src/features' ? 'src/' : '';
}

function jestConfig(featuresRoot: FeaturesRoot): string {
  const root = aliasRoot(featuresRoot);
  if (root === '') return "module.exports = require('@timothyrusso/config-presets/jest');\n";
  return [
    "const preset = require('@timothyrusso/config-presets/jest');",
    '',
    `module.exports = { ...preset, moduleNameMapper: { '^@/(.*)$': '<rootDir>/${root}$1' } };`,
    '',
  ].join('\n');
}

interface FileStep {
  /** Path in the app. */
  readonly to: string;
  /** Other file names that would make ESLint, Jest, Biome or commitlint load a second config. */
  readonly rivals?: readonly string[];
  readonly content: () => string;
}

/**
 * Writes the kit's config files into an app, merges its `package.json`, `tsconfig.json` and
 * `.claude/settings.json`, and (unless `install` is false) installs the tools and hooks. Returns
 * the process exit code.
 */
export async function init(options: InitOptions): Promise<number> {
  const { cwd, packageRoot, force, write } = options;
  const run =
    options.run ??
    ((command: string, args: readonly string[]) => spawnSync(command, args, { cwd, stdio: 'inherit' }).status ?? 1);
  const pkgFile = join(cwd, 'package.json');
  if (!existsSync(pkgFile)) {
    write(`FAIL: no package.json in ${cwd}. Run init at the app root.`);
    return 1;
  }
  const pkg = readJson<PackageJson>(pkgFile);
  const kitVersion = readJson<{ version: string }>(join(packageRoot, 'package.json')).version;
  const kitConfigFile = join(cwd, KIT_CONFIG_FILE);
  const existingConfig = existsSync(kitConfigFile) ? readJson<Record<string, unknown>>(kitConfigFile) : undefined;
  const keepConfig = existingConfig !== undefined && !force;

  const answers = keepConfig
    ? defaults(cwd, pkg, existingConfig)
    : await resolveAnswers(options, defaults(cwd, pkg, existingConfig));
  const config = keepConfig ? parseKitConfig(existingConfig) : undefined;
  const featuresRoot = (config?.featuresRoot ?? answers.featuresRoot) as FeaturesRoot;

  const touched: string[] = [];
  const report = (action: string, file: string) => write(`  ${action.padEnd(8)}${file}`);
  const template = (path: string) => () => readFileSync(join(packageRoot, path), 'utf8');

  write('config-presets init');
  if (keepConfig) report('kept', KIT_CONFIG_FILE);
  else {
    writeFileSync(kitConfigFile, json(kitConfigJson(answers)));
    touched.push(KIT_CONFIG_FILE);
    report('wrote', KIT_CONFIG_FILE);
  }

  const steps: FileStep[] = [
    {
      to: 'biome.json',
      rivals: ['biome.jsonc'],
      content: () =>
        json({
          $schema: './node_modules/@biomejs/biome/configuration_schema.json',
          extends: ['@timothyrusso/config-presets/biome'],
        }),
    },
    {
      to: 'commitlint.config.cjs',
      rivals: [
        'commitlint.config.js',
        'commitlint.config.mjs',
        'commitlint.config.ts',
        '.commitlintrc.json',
        '.commitlint.cjs',
        '.commitlintrc.js',
      ],
      content: () => "module.exports = { extends: ['@timothyrusso/config-presets/commitlint'] };\n",
    },
    { to: 'lefthook.yml', rivals: ['lefthook.yaml', '.lefthook.yml'], content: template('lefthook.yml') },
    {
      to: 'eslint.config.mjs',
      rivals: ['eslint.config.js', 'eslint.config.cjs', 'eslint.config.ts', '.eslintrc.js', '.eslintrc.json'],
      content: template('templates/eslint.config.template.mjs'),
    },
    {
      to: '.dependency-cruiser.mjs',
      rivals: ['.dependency-cruiser.js', '.dependency-cruiser.cjs', '.dependency-cruiser.json'],
      content: template('templates/dependency-cruiser.template.mjs'),
    },
    {
      to: 'jest.config.cjs',
      rivals: ['jest.config.js', 'jest.config.mjs', 'jest.config.ts', 'jest.config.json'],
      content: () => jestConfig(featuresRoot),
    },
    { to: '.github/workflows/pr-checks.yml', content: template('github/pr-checks.yml') },
    { to: '.github/ISSUE_TEMPLATE/feature.yml', content: template('github/ISSUE_TEMPLATE/feature.yml') },
    { to: '.github/ISSUE_TEMPLATE/config.yml', content: template('github/ISSUE_TEMPLATE/config.yml') },
    { to: '.nvmrc', content: () => '22\n' },
  ];

  for (const step of steps) {
    const target = join(cwd, step.to);
    const rival = step.rivals?.find(name => existsSync(join(cwd, name)));
    if (rival) {
      report('kept', `${rival} (merge the kit's ${step.to} into it by hand)`);
      continue;
    }
    if (existsSync(target) && !force) {
      report('kept', step.to);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, step.content());
    touched.push(step.to);
    report('wrote', step.to);
  }

  const settingsFile = join(cwd, '.claude', 'settings.json');
  const settingsTemplate = readJson<ClaudeSettings>(join(packageRoot, '.claude', 'settings.template.json'));
  mkdirSync(dirname(settingsFile), { recursive: true });
  if (existsSync(settingsFile)) {
    writeFileSync(settingsFile, json(mergeClaudeSettings(readJson<ClaudeSettings>(settingsFile), settingsTemplate)));
    report('merged', '.claude/settings.json');
  } else {
    copyFileSync(join(packageRoot, '.claude', 'settings.template.json'), settingsFile);
    report('wrote', '.claude/settings.json');
  }
  touched.push('.claude/settings.json');

  const warnings: string[] = [];
  const tsconfigFile = join(cwd, 'tsconfig.json');
  const alias = { '@/*': [`./${aliasRoot(featuresRoot)}*`] };
  if (!existsSync(tsconfigFile)) {
    writeFileSync(tsconfigFile, json({ extends: TSCONFIG_PRESET, compilerOptions: { paths: alias } }));
    touched.push('tsconfig.json');
    report('wrote', 'tsconfig.json');
  } else {
    let tsconfig: { extends?: unknown; compilerOptions?: Record<string, unknown> } | undefined;
    try {
      tsconfig = readJson(tsconfigFile);
    } catch {
      warnings.push(`tsconfig.json is not plain JSON: set "extends": "${TSCONFIG_PRESET}" by hand`);
    }
    if (tsconfig) {
      const replaceable = tsconfig.extends === undefined || tsconfig.extends === 'expo/tsconfig.base';
      if (replaceable || force) tsconfig.extends = TSCONFIG_PRESET;
      else if (tsconfig.extends !== TSCONFIG_PRESET) {
        warnings.push(`tsconfig.json extends ${JSON.stringify(tsconfig.extends)}: add "${TSCONFIG_PRESET}" by hand`);
      }
      tsconfig.compilerOptions = { ...(tsconfig.compilerOptions ?? {}) };
      tsconfig.compilerOptions.paths ??= alias;
      writeFileSync(tsconfigFile, json(tsconfig));
      touched.push('tsconfig.json');
      report('merged', 'tsconfig.json');
    }
  }

  if (aliasRoot(featuresRoot) === '' && adoptStockEntry(join(cwd, 'index.ts'))) {
    touched.push('index.ts');
    report('updated', "index.ts (create-expo-app's entry: App through the @/ alias, comments dropped)");
  }

  const answeredDashes = config?.lint?.dashes ?? answers.dashes;
  if (answeredDashes === 'forbid') {
    const docs = readdirSync(cwd).filter(name => name.endsWith('.md'));
    const fixed = checkText({ rootDir: cwd, config: { lint: { dashes: 'forbid' } }, files: docs, fix: true });
    for (const file of fixed.problems) report('updated', `${file} (em and en dashes replaced with hyphens)`);
  }

  const plan = planPackageJson(pkg, kitVersion, force);
  writeFileSync(pkgFile, json(plan.packageJson));
  report('merged', `package.json (scripts: ${plan.scriptsAdded.join(', ') || 'none added'})`);
  for (const name of plan.scriptsKept)
    warnings.push(`script "${name}" already exists and was kept: use --force to replace it`);
  warnings.push(...plan.warnings);

  const next: string[] = [];
  if (options.install) {
    if (plan.devDependenciesAdded.length > 0 || !existsSync(join(cwd, 'node_modules'))) {
      if (run('npm', ['install']) !== 0) return fail(write, 'npm install failed');
    }
    if (plan.expoTestPackagesMissing.length > 0 && plan.packageJson.dependencies?.expo !== undefined) {
      if (run('npx', ['expo', 'install', '--dev', ...plan.expoTestPackagesMissing]) !== 0) {
        return fail(write, 'npx expo install failed');
      }
    }
    const formattable = [...touched, 'package.json'].filter(file => /\.(json|jsonc|js|cjs|mjs)$/.test(file));
    if (run('npx', ['--no-install', 'biome', 'format', '--write', ...formattable]) !== 0) {
      warnings.push('biome format failed on the written files: run npm run format');
    }
    if (run('npx', ['--no-install', 'lefthook', 'install']) !== 0) warnings.push('lefthook install failed');
  } else {
    next.push('npm install');
    if (plan.expoTestPackagesMissing.length > 0) {
      next.push(`npx expo install --dev ${plan.expoTestPackagesMissing.join(' ')}`);
    }
    next.push('npm run format');
  }
  next.push('npm run check');

  for (const warning of warnings) write(`  warning ${warning}`);
  write(`Next: ${next.join(', then ')}`);
  return 0;
}

/** The code of create-expo-app's `index.ts` (blank templates), without its comment lines. */
const STOCK_ENTRY =
  "import { registerRootComponent } from 'expo';\nimport App from './App';\nregisterRootComponent(App);";

/** The same entry written to the kit's rules: no relative import, no plain comments. */
const KIT_ENTRY =
  "import { registerRootComponent } from 'expo';\n\nimport App from '@/App';\n\nregisterRootComponent(App);\n";

/**
 * Rewrites `index.ts` to `KIT_ENTRY` when it is still create-expo-app's untouched entry, which
 * imports `./App` relatively and carries plain comments. Any other `index.ts` is left alone.
 */
function adoptStockEntry(file: string): boolean {
  if (!existsSync(file)) return false;
  const code = readFileSync(file, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '' && !line.startsWith('//'))
    .join('\n');
  if (code !== STOCK_ENTRY) return false;
  writeFileSync(file, KIT_ENTRY);
  return true;
}

function fail(write: (line: string) => void, message: string): number {
  write(`FAIL: ${message}`);
  return 1;
}
