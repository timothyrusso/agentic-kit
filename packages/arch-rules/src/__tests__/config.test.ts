import { createArchRules, createDependencyCruiserConfig } from '../createArchRules.js';
import { FeatureTierError, findFeatureTiers } from '../featureTiers.js';
import { removeFixtures, writeFixture } from './helpers.js';

afterAll(removeFixtures);

describe('findFeatureTiers', () => {
  it('reads features and core concerns, and ignores folders without a tier', () => {
    const root = writeFixture({
      'features/catalog/index.ts': 'export const FEATURE_TIER: FeatureTier = 1;\n',
      'features/core/dates/index.ts': 'export const FEATURE_TIER = 0;\n',
      'features/core/featureTier.ts': 'export type FeatureTier = 0 | 1;\n',
      'features/notes/index.ts': 'export {};\n',
      'features/catalog/ui/deep/index.ts': 'export const FEATURE_TIER: FeatureTier = 2;\n',
    });
    expect(findFeatureTiers(root, 'features')).toEqual({ 'features/catalog': 1, 'features/core/dates': 0 });
  });

  it('rejects a tier above 5', () => {
    const root = writeFixture({ 'features/catalog/index.ts': 'export const FEATURE_TIER: FeatureTier = 6;\n' });
    expect(() => findFeatureTiers(root, 'features')).toThrow(FeatureTierError);
  });

  it('returns no features when the folder is missing', () => {
    expect(findFeatureTiers(writeFixture({}), 'features')).toEqual({});
  });
});

describe('createDependencyCruiserConfig', () => {
  it('wraps createArchRules with the resolver options', () => {
    const config = { featuresRoot: 'src/features', appRoot: 'app' };
    const featureTiers = { 'src/features/catalog': 1 } as const;
    const cruiser = createDependencyCruiserConfig(config, { featureTiers, tsConfigFile: 'tsconfig.app.json' });

    expect(cruiser.forbidden).toEqual(createArchRules(config, { featureTiers }));
    expect(cruiser.options?.tsConfig).toEqual({ fileName: 'tsconfig.app.json' });
    expect(cruiser.options?.tsPreCompilationDeps).toBe(true);
    expect(cruiser.options?.reporterOptions?.archi?.collapsePattern).toMatch(/^\^\(\?:src\/features\|app\)/);
  });
});

describe('Effect module patterns', () => {
  const rules = createArchRules({ featuresRoot: 'features', appRoot: 'app' }, { featureTiers: {} });
  const toPath = (name: string): RegExp => new RegExp(rules.find(rule => rule.name === name)?.to.path as string);

  it.each([
    'effect/ManagedRuntime',
    'node_modules/effect/ManagedRuntime.js',
    'node_modules/effect/dist/esm/ManagedRuntime.js',
    'node_modules/effect/dist/dts/Runtime.d.ts',
    'node_modules/.pnpm/effect@3.19.0/node_modules/effect/dist/cjs/Runtime.js',
  ])('treats %s as a runtime module', path => {
    expect(toPath('facades-run-through-boundary').test(path)).toBe(true);
  });

  it.each(['node_modules/effect/dist/esm/FiberRuntime.js', 'node_modules/effect/dist/dts/Effect.d.ts'])(
    'does not treat %s as a runtime module',
    path => {
      expect(toPath('facades-run-through-boundary').test(path)).toBe(false);
    },
  );

  it.each(['effect', 'effect/Schema', '@effect/platform', 'node_modules/effect/dist/dts/index.d.ts'])(
    'treats %s as Effect',
    path => {
      expect(toPath('effect-only-in-inner-layers').test(path)).toBe(true);
    },
  );

  it.each(['effectful', 'node_modules/effectful/index.js', 'features/catalog/effect/x.ts'])(
    'does not treat %s as Effect',
    path => {
      expect(toPath('effect-only-in-inner-layers').test(path)).toBe(false);
    },
  );
});
