import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint, type Linter } from 'eslint';
import { configs, type LintKitConfig } from '../index.js';

const FIXTURE = join(__dirname, 'fixtures', 'app');
const kitConfig: LintKitConfig = JSON.parse(readFileSync(join(FIXTURE, 'kit.config.json'), 'utf8'));

async function lintFixture(config: LintKitConfig = kitConfig): Promise<Map<string, Linter.LintMessage[]>> {
  const eslint = new ESLint({
    cwd: FIXTURE,
    overrideConfigFile: true,
    overrideConfig: configs.recommended(config),
  });
  const results = await eslint.lintFiles(['app', 'features']);
  return new Map(results.map(result => [result.filePath.slice(FIXTURE.length + 1), result.messages]));
}

const ruleIds = (messages: Linter.LintMessage[] | undefined) => (messages ?? []).map(m => m.ruleId).sort();

describe('configs.recommended on the fixture app', () => {
  let byFile: Map<string, Linter.LintMessage[]>;

  beforeAll(async () => {
    byFile = await lintFixture();
  });

  it('lints every fixture file', () => {
    expect([...byFile.keys()].sort()).toEqual([
      'app/broken/index.tsx',
      'app/items/index.tsx',
      'features/broken/facades/useBroken.ts',
      'features/broken/ui/BrokenPage.logic.ts',
      'features/broken/ui/BrokenPage.tsx',
      'features/core/design-system/Chart.tsx',
      'features/core/design-system/Spinner.tsx',
      'features/core/design-system/tokens.ts',
      'features/items/facades/useItems.ts',
      'features/items/ui/ItemRow.tsx',
      'features/items/ui/ItemsPage.logic.ts',
      'features/items/ui/ItemsPage.style.ts',
      'features/items/ui/ItemsPage.tsx',
    ]);
  });

  it('reports nothing on the files that follow the architecture, allowed hooks included', () => {
    const clean = [...byFile].filter(([file]) => !file.includes('broken'));
    expect(clean.filter(([, messages]) => messages.length > 0)).toEqual([]);
  });

  it('owes the clean page to the allowlist: without it the two extra hooks are foreign', async () => {
    const withoutAllow = await lintFixture({ ...kitConfig, lint: { ...kitConfig.lint, allowedHooksInViews: [] } });
    expect(ruleIds(withoutAllow.get('features/items/ui/ItemsPage.tsx'))).toEqual([
      'arch/prefer-viewmodel',
      'arch/prefer-viewmodel',
    ]);
  });

  it('reports every deliberate violation in the broken view', () => {
    expect(ruleIds(byFile.get('features/broken/ui/BrokenPage.tsx'))).toEqual([
      'arch/no-effect-in-views',
      'arch/no-inline-comments',
      'arch/no-jsx-comment-text',
      'arch/no-relative-imports',
      'arch/prefer-viewmodel',
      'arch/stable-row-handlers',
      'arch/stable-row-handlers',
      'no-restricted-imports',
      'no-restricted-syntax',
      'no-restricted-syntax',
    ]);
  });

  it('reports the literal and the non-gutter token in a route, and not outside the layout folders', () => {
    expect(ruleIds(byFile.get('app/broken/index.tsx'))).toEqual(['arch/no-literal-gutter', 'arch/no-literal-gutter']);
    expect(byFile.get('features/broken/ui/BrokenPage.tsx')?.some(m => m.ruleId === 'arch/no-literal-gutter')).toBe(
      false,
    );
  });

  it('reports the grab-bag ViewModel and the facade that runs its own Effect', () => {
    expect(ruleIds(byFile.get('features/broken/ui/BrokenPage.logic.ts'))).toEqual(['arch/viewmodel-return-shape']);
    expect(ruleIds(byFile.get('features/broken/facades/useBroken.ts'))).toEqual(['arch/no-effect-run-in-facades']);
  });
});

describe('configs.recommended options', () => {
  const rulesOf = (config: LintKitConfig) =>
    Object.assign({}, ...configs.recommended(config).map(block => block.rules ?? {}));

  it('defaults to every always-on rule plus no-dashes, with an empty hook allowlist', () => {
    const rules = rulesOf({});
    expect(rules['arch/no-dashes']).toBe('error');
    expect(rules['arch/prefer-viewmodel']).toEqual(['error', { allow: [] }]);
    expect(rules['arch/no-literal-gutter']).toBeUndefined();
    expect(rules['no-restricted-imports']).toBeUndefined();
  });

  it('drops no-dashes when dashes are allowed', () => {
    expect(rulesOf({ lint: { dashes: 'allow' } })['arch/no-dashes']).toBeUndefined();
  });

  it('scopes the layout rule to the app folder and the design system', () => {
    const blocks = configs.recommended({
      appRoot: 'src/app',
      featuresRoot: 'src/features',
      lint: { layoutTokens: { gutterToken: 'gutter', spacingImport: '@/tokens', allowlistFile: 'layout.allow' } },
    });
    const layout = blocks.find(block => block.name === 'arch/recommended/layout');
    expect(layout?.files).toEqual(['src/app/**/*.{ts,tsx}', 'src/features/core/design-system/**/*.{ts,tsx}']);
    expect(layout?.rules?.['arch/no-literal-gutter']).toEqual([
      'error',
      { gutterToken: 'gutter', spacingImport: '@/tokens', allowlistFile: 'layout.allow' },
    ]);
  });
});
