import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeClaudeSettings } from '../init/claudeSettings.js';
import { type InitFlags, init } from '../init/init.js';
import { APP_SCRIPTS, planPackageJson } from '../init/packageJson.js';
import { loadKitConfig } from '../kitConfig.js';
import { cleanup, PACKAGE_ROOT, writeTree } from './helpers.js';

afterAll(cleanup);

const EXPO_APP = {
  'package.json': JSON.stringify({
    name: 'acme-app',
    main: 'index.ts',
    scripts: { start: 'expo start' },
    dependencies: { expo: '~57.0.0' },
    devDependencies: { typescript: '~6.0.3' },
  }),
  'tsconfig.json': JSON.stringify({ extends: 'expo/tsconfig.base', compilerOptions: { strict: true } }),
  '.claude/settings.json': JSON.stringify({ enabledPlugins: { 'expo@claude-plugins-official': true } }),
  'AGENTS.md': `# Expo has changed ${String.fromCharCode(0x2014)} read the docs\n`,
  'index.ts': [
    "import { registerRootComponent } from 'expo';",
    '',
    "import App from './App';",
    '',
    "// registerRootComponent calls AppRegistry.registerComponent('main', () => App);",
    'registerRootComponent(App);',
    '',
  ].join('\n'),
};

const readJson = (root: string, file: string) => JSON.parse(readFileSync(join(root, file), 'utf8'));

async function runInit(root: string, flags: InitFlags = {}, extra: { force?: boolean; ask?: boolean } = {}) {
  const lines: string[] = [];
  const questions: string[] = [];
  const code = await init({
    cwd: root,
    packageRoot: PACKAGE_ROOT,
    yes: !extra.ask,
    force: extra.force ?? false,
    install: false,
    flags,
    ask: async (question, fallback) => {
      questions.push(question);
      return question.startsWith('Translation') ? 'src/i18n' : fallback;
    },
    write: line => lines.push(line),
  });
  return { code, lines, questions };
}

describe('init --yes --no-install on a fresh Expo app', () => {
  let root: string;
  let output: string[];

  beforeAll(async () => {
    root = writeTree(EXPO_APP);
    const { code, lines } = await runInit(root);
    expect(code).toBe(0);
    output = lines;
  });

  it('writes a valid kit.config.json from the defaults', () => {
    expect(readJson(root, 'kit.config.json')).toEqual({
      $schema: './node_modules/@timothyrusso/config-presets/dist/kitConfig.schema.json',
      projectName: 'acme-app',
      featuresRoot: 'features',
      appRoot: 'app',
      lint: { dashes: 'forbid' },
    });
    expect(loadKitConfig({ cwd: root }).projectName).toBe('acme-app');
  });

  it('writes every config file', () => {
    for (const file of [
      'biome.json',
      'commitlint.config.cjs',
      'lefthook.yml',
      'eslint.config.mjs',
      '.dependency-cruiser.mjs',
      'jest.config.cjs',
      '.github/workflows/pr-checks.yml',
      '.github/ISSUE_TEMPLATE/feature.yml',
      '.github/ISSUE_TEMPLATE/config.yml',
      '.nvmrc',
    ]) {
      expect(existsSync(join(root, file))).toBe(true);
    }
    expect(readFileSync(join(root, 'lefthook.yml'), 'utf8')).toBe(
      readFileSync(join(PACKAGE_ROOT, 'lefthook.yml'), 'utf8'),
    );
    expect(readJson(root, 'biome.json').extends).toEqual(['@timothyrusso/config-presets/biome']);
    expect(readFileSync(join(root, '.github/ISSUE_TEMPLATE/feature.yml'), 'utf8')).toContain(
      'label: Acceptance criteria',
    );
  });

  it('points tsconfig.json at the preset and adds the @/ alias', () => {
    expect(readJson(root, 'tsconfig.json')).toEqual({
      extends: '@timothyrusso/config-presets/tsconfig/expo.json',
      compilerOptions: { strict: true, paths: { '@/*': ['./*'] } },
    });
  });

  it("rewrites create-expo-app's stock index.ts to the alias, without comments", () => {
    expect(readFileSync(join(root, 'index.ts'), 'utf8')).toBe(
      "import { registerRootComponent } from 'expo';\n\nimport App from '@/App';\n\nregisterRootComponent(App);\n",
    );
  });

  it('replaces the dashes in root Markdown files', () => {
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe('# Expo has changed - read the docs\n');
    expect(output).toContain('  updated AGENTS.md (em and en dashes replaced with hyphens)');
  });

  it('merges the kit permissions and marketplace into .claude/settings.json', () => {
    const settings = readJson(root, '.claude/settings.json');
    expect(settings.enabledPlugins).toEqual({ 'agentic-kit@agentic-kit': true, 'expo@claude-plugins-official': true });
    expect(settings.extraKnownMarketplaces['agentic-kit'].source).toEqual({
      source: 'github',
      repo: 'timothyrusso/agentic-kit',
    });
    expect(settings.permissions.allow).toContain('Bash(agent-device *)');
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining([
        'Bash(git commit *--no-verify*)',
        'Bash(git push *--force*)',
        'Read(~/.ssh/**)',
        'Read(./.env)',
      ]),
    );
  });

  it('adds the scripts, the prepare hook and the tools, keeping typescript 6', () => {
    const pkg = readJson(root, 'package.json');
    expect(pkg.scripts).toEqual({ start: 'expo start', ...APP_SCRIPTS, prepare: 'lefthook install' });
    expect(pkg.devDependencies).toMatchObject({
      '@timothyrusso/config-presets': '^0.0.0',
      '@timothyrusso/arch-rules': '^0.0.0',
      '@timothyrusso/eslint-plugin-arch': '^0.0.0',
      'dependency-cruiser': '^18.4.0',
      typescript: '~6.0.3',
    });
    expect(output.at(-1)).toBe(
      'Next: npm install, then npx expo install --dev jest-expo jest @types/jest, then npm run format, then npm run check',
    );
  });

  it('keeps what exists on a second run', async () => {
    const { lines } = await runInit(root);
    expect(lines).toContain('  kept    kit.config.json');
    expect(lines).toContain('  kept    eslint.config.mjs');
    expect(readJson(root, '.claude/settings.json').permissions.deny).toHaveLength(
      new Set(readJson(root, '.claude/settings.json').permissions.deny).size,
    );
  });
});

describe('init answers and conflicts', () => {
  it('takes answers from flags and maps the alias to src for a src/features layout', async () => {
    const root = writeTree(EXPO_APP);
    await runInit(root, {
      projectName: 'acme',
      featuresRoot: 'src/features',
      appRoot: 'src/app',
      i18n: 'src/i18n',
      languages: ['en', 'it'],
      dashes: 'allow',
    });
    expect(readJson(root, 'kit.config.json')).toMatchObject({
      projectName: 'acme',
      featuresRoot: 'src/features',
      appRoot: 'src/app',
      lint: { dashes: 'allow' },
      i18n: { catalogPath: 'src/i18n', languages: ['en', 'it'] },
    });
    expect(readJson(root, 'tsconfig.json').compilerOptions.paths).toEqual({ '@/*': ['./src/*'] });
    expect(readFileSync(join(root, 'jest.config.cjs'), 'utf8')).toContain("'<rootDir>/src/$1'");
  });

  it('asks when interactive', async () => {
    const root = writeTree(EXPO_APP);
    const { questions } = await runInit(root, {}, { ask: true });
    expect(questions).toHaveLength(6);
    expect(readJson(root, 'kit.config.json').i18n).toEqual({ catalogPath: 'src/i18n', languages: ['en'] });
  });

  it('rejects an answer the schema does not allow', async () => {
    await expect(runInit(writeTree(EXPO_APP), { featuresRoot: 'modules' })).rejects.toThrow(
      '"featuresRoot" must be one of: features, src/features',
    );
  });

  it('keeps a rival config, an existing script and an edited index.ts', async () => {
    const edited =
      "import { registerRootComponent } from 'expo';\nimport App from './src/App';\nregisterRootComponent(App);\n";
    const root = writeTree({
      ...EXPO_APP,
      'index.ts': edited,
      'package.json': JSON.stringify({ name: 'a', scripts: { lint: 'expo lint' }, dependencies: { expo: '1' } }),
      'eslint.config.js': 'export default [];',
    });
    const { lines } = await runInit(root);
    expect(existsSync(join(root, 'eslint.config.mjs'))).toBe(false);
    expect(lines).toContain("  kept    eslint.config.js (merge the kit's eslint.config.mjs into it by hand)");
    expect(lines).toContain('  warning script "lint" already exists and was kept: use --force to replace it');
    expect(readJson(root, 'package.json').scripts.lint).toBe('expo lint');
    expect(readFileSync(join(root, 'index.ts'), 'utf8')).toBe(edited);
  });

  it('fails without a package.json', async () => {
    const { code, lines } = await runInit(writeTree({}));
    expect(code).toBe(1);
    expect(lines[0]).toMatch(/^FAIL: no package.json/);
  });
});

describe('init with install', () => {
  it('installs the tools, the Expo test packages as devDependencies, formats and installs the hooks', async () => {
    const root = writeTree(EXPO_APP);
    const commands: string[] = [];
    const code = await init({
      cwd: root,
      packageRoot: PACKAGE_ROOT,
      yes: true,
      force: false,
      install: true,
      flags: {},
      run: (command, args) => {
        commands.push([command, ...args].join(' '));
        return 0;
      },
      write: () => undefined,
    });
    expect(code).toBe(0);
    expect(commands.map(command => command.split(' ').slice(0, 4).join(' '))).toEqual([
      'npm install',
      'npx expo install --dev',
      'npx --no-install biome format',
      'npx --no-install lefthook install',
    ]);
    expect(commands[1]).toBe('npx expo install --dev jest-expo jest @types/jest');
    expect(commands[2]).toContain('kit.config.json');
  });

  it('stops when npm install fails', async () => {
    const lines: string[] = [];
    const code = await init({
      cwd: writeTree(EXPO_APP),
      packageRoot: PACKAGE_ROOT,
      yes: true,
      force: false,
      install: true,
      flags: {},
      run: () => 1,
      write: line => lines.push(line),
    });
    expect(code).toBe(1);
    expect(lines.at(-1)).toBe('FAIL: npm install failed');
  });
});

describe('planPackageJson', () => {
  it('appends lefthook to an existing prepare script and warns about TypeScript 7', () => {
    const plan = planPackageJson(
      { scripts: { prepare: 'husky' }, devDependencies: { typescript: '^7.0.0', expo: '1' } },
      '0.1.0',
      false,
    );
    expect(plan.packageJson.scripts?.prepare).toBe('husky && lefthook install');
    expect(plan.warnings).toEqual([
      'typescript ^7.0.0: dependency-cruiser 18 does not support TypeScript 7, use ~5.9.3 or 6.x',
    ]);
    expect(plan.packageJson.devDependencies?.['@timothyrusso/arch-rules']).toBe('^0.1.0');
  });

  it('pins typescript to 5.9 when the app has none', () => {
    expect(planPackageJson({}, '0.1.0', false).packageJson.devDependencies?.typescript).toBe('~5.9.3');
  });
});

describe('mergeClaudeSettings', () => {
  it('unions permission lists and keeps the app entries', () => {
    const merged = mergeClaudeSettings(
      { permissions: { deny: ['A'], ask: ['X'] }, enabledPlugins: { 'agentic-kit@agentic-kit': false } },
      { permissions: { allow: ['B'], deny: ['A', 'C'] }, enabledPlugins: { 'agentic-kit@agentic-kit': true } },
    );
    expect(merged).toEqual({
      permissions: { deny: ['A', 'C'], ask: ['X'], allow: ['B'] },
      enabledPlugins: { 'agentic-kit@agentic-kit': false },
      extraKnownMarketplaces: {},
    });
  });
});
