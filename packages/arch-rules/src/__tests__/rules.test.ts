import { type ArchRulesOptions, createArchRules } from '../createArchRules.js';
import type { FeatureTiers } from '../featureTiers.js';
import type { ArchKitConfig } from '../paths.js';
import { cruiseFixture, type FixtureTree, npmPackage, removeFixtures, writeFixture } from './helpers.js';

const CONFIG: ArchKitConfig = { featuresRoot: 'features', appRoot: 'app' };

const TIERS: FeatureTiers = {
  'features/core/error': 0,
  'features/core/runtime': 0,
  'features/core/design-system': 0,
  'features/core/navigation': 0,
  'features/core/dates': 0,
  'features/catalog': 1,
  'features/reviews': 1,
  'features/orders': 2,
};

const PACKAGES: FixtureTree = {
  ...npmPackage('effect', ['ManagedRuntime.js', 'Runtime.js']),
  ...npmPackage('@effect/platform'),
  ...npmPackage('lodash'),
  ...npmPackage('@timothyrusso/effect-core', ['react.js']),
};

interface RuleCase {
  /** What the fixture shows. */
  title: string;
  tree: FixtureTree;
  config?: ArchKitConfig;
  options?: ArchRulesOptions;
}

async function violationsOf(rule: string, fixture: RuleCase) {
  const config = fixture.config ?? CONFIG;
  const rules = createArchRules(config, { featureTiers: TIERS, ...fixture.options });
  const root = writeFixture({ ...PACKAGES, ...fixture.tree });
  const files = Object.keys(fixture.tree);
  const folders = [config.featuresRoot, config.appRoot].filter(folder =>
    files.some(file => file.startsWith(`${folder}/`)),
  );
  const found = await cruiseFixture(root, rules, folders);
  return found.filter(v => v.rule === rule);
}

function describeRule(rule: string, violating: readonly RuleCase[], passing: readonly RuleCase[]): void {
  describe(rule, () => {
    for (const fixture of violating) {
      it(`reports ${fixture.title}`, async () => {
        expect(await violationsOf(rule, fixture)).not.toEqual([]);
      });
    }
    for (const fixture of passing) {
      it(`allows ${fixture.title}`, async () => {
        expect(await violationsOf(rule, fixture)).toEqual([]);
      });
    }
  });
}

const ts = (...lines: string[]): string => `${lines.join('\n')}\n`;

function importsEffect(file: string, specifier = 'effect'): RuleCase {
  return {
    title: specifier === 'effect' ? file : `${specifier} in ${file}`,
    tree: { [file]: ts(`import { Effect } from '${specifier}';`, 'export const x = Effect;') },
  };
}

afterAll(removeFixtures);

describe('tier rules', () => {
  describeRule(
    'no-tier-violation-features-catalog',
    [
      {
        title: 'a Tier 1 feature importing a Tier 1 peer',
        tree: {
          'features/catalog/useCases/list.ts': ts(
            "import { review } from '../../reviews';",
            'export const list = review;',
          ),
          'features/reviews/index.ts': ts('export const review = 1;'),
        },
      },
      {
        title: 'a Tier 1 feature importing a Tier 2 feature',
        tree: {
          'features/catalog/useCases/list.ts': ts(
            "import { order } from '../../orders';",
            'export const list = order;',
          ),
          'features/orders/index.ts': ts('export const order = 1;'),
        },
      },
    ],
    [
      {
        title: 'a Tier 1 feature importing Tier 0',
        tree: {
          'features/catalog/useCases/list.ts': ts(
            "import { day } from '../../core/dates';",
            'export const list = day;',
          ),
          'features/core/dates/index.ts': ts('export const day = 1;'),
        },
      },
    ],
  );

  describeRule(
    'no-tier-violation-features-core-dates',
    [
      {
        title: 'Tier 0 importing a Tier 1 feature',
        tree: {
          'features/core/dates/data/clock.ts': ts(
            "import { list } from '../../../catalog';",
            'export const clock = list;',
          ),
          'features/catalog/index.ts': ts('export const list = 1;'),
        },
      },
    ],
    [
      {
        title: 'Tier 0 importing a Tier 0 peer',
        tree: {
          'features/core/dates/data/clock.ts': ts(
            "import { toAppError } from '../../error';",
            'export const clock = toAppError;',
          ),
          'features/core/error/index.ts': ts('export const toAppError = 1;'),
        },
      },
    ],
  );

  describe('tiers up to 5', () => {
    const options = { featureTiers: { 'features/top': 5, 'features/mid': 4 } } as const;
    describeRule(
      'no-tier-violation-features-mid',
      [
        {
          title: 'Tier 4 importing Tier 5',
          options,
          tree: {
            'features/mid/data/a.ts': ts("import { t } from '../../top';", 'export const a = t;'),
            'features/top/index.ts': ts('export const t = 1;'),
          },
        },
      ],
      [],
    );
    describeRule(
      'no-tier-violation-features-top',
      [
        {
          title: 'Tier 5 importing a Tier 5 peer',
          options: { featureTiers: { 'features/top': 5, 'features/peer': 5 } },
          tree: {
            'features/top/data/a.ts': ts("import { p } from '../../peer';", 'export const a = p;'),
            'features/peer/index.ts': ts('export const p = 1;'),
          },
        },
      ],
      [
        {
          title: 'Tier 5 importing Tier 4',
          options,
          tree: {
            'features/top/data/a.ts': ts("import { m } from '../../mid';", 'export const a = m;'),
            'features/mid/index.ts': ts('export const m = 1;'),
          },
        },
      ],
    );
  });
});

describeRule(
  'enforce-index-boundary-features-catalog',
  [
    {
      title: 'a deep import into another feature',
      tree: {
        'features/orders/useCases/place.ts': ts(
          "import { repo } from '../../catalog/data/repo';",
          'export const place = repo;',
        ),
        'features/catalog/data/repo.ts': ts('export const repo = 1;'),
      },
    },
  ],
  [
    {
      title: 'imports through index.ts, pages.ts and assets/',
      tree: {
        'features/orders/useCases/place.ts': ts(
          "import { repo } from '../../catalog';",
          "import { Page } from '../../catalog/pages';",
          "import { icon } from '../../catalog/assets/icon';",
          'export const place = [repo, Page, icon];',
        ),
        'features/catalog/index.ts': ts('export const repo = 1;'),
        'features/catalog/pages.ts': ts('export const Page = 1;'),
        'features/catalog/assets/icon.ts': ts('export const icon = 1;'),
      },
    },
  ],
);

describeRule(
  'tsx-no-direct-layer-import',
  [
    {
      title: 'a view importing a facade',
      tree: {
        'features/catalog/ui/List.tsx': ts(
          "import { useList } from '../facades/useList';",
          'export const List = useList;',
        ),
        'features/catalog/facades/useList.ts': ts('export const useList = 1;'),
      },
    },
  ],
  [
    {
      title: 'a view importing its ViewModel and styles',
      tree: {
        'features/catalog/ui/List.tsx': ts(
          "import { useListLogic } from './List.logic';",
          "import { styles } from './List.style';",
          'export const List = [useListLogic, styles];',
        ),
        'features/catalog/ui/List.logic.ts': ts('export const useListLogic = 1;'),
        'features/catalog/ui/List.style.ts': ts('export const styles = 1;'),
      },
    },
  ],
);

describeRule(
  'tsx-no-runtime-domain-import',
  [
    {
      title: 'a view importing a runtime value from domain/',
      tree: {
        'features/catalog/ui/List.tsx': ts("import { limit } from '../domain/item';", 'export const List = limit;'),
        'features/catalog/domain/item.ts': ts('export const limit = 1;', 'export type Item = { id: string };'),
      },
    },
  ],
  [
    {
      title: 'a view importing a type from domain/',
      tree: {
        'features/catalog/ui/List.tsx': ts(
          "import type { Item } from '../domain/item';",
          'export const List = (i: Item) => i;',
        ),
        'features/catalog/domain/item.ts': ts('export type Item = { id: string };'),
      },
    },
  ],
);

describeRule(
  'tsx-no-cross-feature-public-api',
  [
    {
      title: "a view importing a runtime value from another feature's index.ts",
      tree: {
        'features/orders/ui/Cart.tsx': ts("import { price } from '../../catalog';", 'export const Cart = price;'),
        'features/catalog/index.ts': ts('export const price = 1;'),
      },
    },
    {
      title: 'the design-system exception removed through options',
      options: { tsxPublicApiExceptions: [] },
      tree: {
        'features/orders/ui/Cart.tsx': ts(
          "import { Button } from '../../core/design-system';",
          'export const Cart = Button;',
        ),
        'features/core/design-system/index.ts': ts('export const Button = 1;'),
      },
    },
  ],
  [
    {
      title: 'the default design-system and navigation exceptions',
      tree: {
        'features/orders/ui/Cart.tsx': ts(
          "import { Button } from '../../core/design-system';",
          "import { Routes } from '../../core/navigation';",
          'export const Cart = [Button, Routes];',
        ),
        'features/core/design-system/index.ts': ts('export const Button = 1;'),
        'features/core/navigation/index.ts': ts('export const Routes = 1;'),
      },
    },
    {
      title: 'a route file in the app folder',
      tree: {
        'app/index.tsx': ts("import { Page } from '../features/catalog';", 'export default Page;'),
        'features/catalog/index.ts': ts('export const Page = 1;'),
      },
    },
  ],
);

describeRule(
  'domain-no-outer-layer-import',
  [
    {
      title: 'domain/ importing data/',
      tree: {
        'features/catalog/domain/item.ts': ts("import { repo } from '../data/repo';", 'export const item = repo;'),
        'features/catalog/data/repo.ts': ts('export const repo = 1;'),
      },
    },
  ],
  [
    {
      title: 'domain/ importing domain/',
      tree: {
        'features/catalog/domain/item.ts': ts("import { price } from './price';", 'export const item = price;'),
        'features/catalog/domain/price.ts': ts('export const price = 1;'),
      },
    },
  ],
);

describeRule(
  'usecases-no-data-import',
  [
    {
      title: 'useCases/ importing data/',
      tree: {
        'features/catalog/useCases/list.ts': ts("import { repo } from '../data/repo';", 'export const list = repo;'),
        'features/catalog/data/repo.ts': ts('export const repo = 1;'),
      },
    },
  ],
  [
    {
      title: 'useCases/ importing domain/',
      tree: {
        'features/catalog/useCases/list.ts': ts("import { Repo } from '../domain/repo';", 'export const list = Repo;'),
        'features/catalog/domain/repo.ts': ts('export const Repo = 1;'),
      },
    },
  ],
);

describeRule(
  'domain-no-cross-feature-runtime-import',
  [
    {
      title: "domain/ importing a runtime value from another feature's index.ts",
      tree: {
        'features/orders/domain/order.ts': ts("import { price } from '../../catalog';", 'export const order = price;'),
        'features/catalog/index.ts': ts('export const price = 1;'),
      },
    },
  ],
  [
    {
      title: 'domain/ importing the core/error exception',
      tree: {
        'features/orders/domain/order.ts': ts(
          "import { AppError } from '../../core/error';",
          'export const order = AppError;',
        ),
        'features/core/error/index.ts': ts('export const AppError = 1;'),
      },
    },
  ],
);

describeRule(
  'no-circular',
  [
    {
      title: 'two modules importing each other',
      tree: {
        'features/catalog/data/a.ts': ts("import { b } from './b';", 'export const a = () => b;'),
        'features/catalog/data/b.ts': ts("import { a } from './a';", 'export const b = () => a;'),
      },
    },
  ],
  [
    {
      title: 'a one-way import',
      tree: {
        'features/catalog/data/a.ts': ts("import { b } from './b';", 'export const a = () => b;'),
        'features/catalog/data/b.ts': ts('export const b = 1;'),
      },
    },
  ],
);

describe('Effect rules', () => {
  describeRule(
    'effect-only-in-inner-layers',
    [
      importsEffect('features/catalog/ui/List.logic.ts'),
      importsEffect('features/catalog/facades/useList.ts'),
      importsEffect('features/catalog/hooks/useThing.ts'),
      importsEffect('features/catalog/state/store.ts'),
      importsEffect('features/catalog/mappers/toView.ts'),
      importsEffect('features/core/navigation/routes.ts'),
      importsEffect('app/index.tsx'),
      importsEffect('features/catalog/facades/useList.ts', '@effect/platform'),
      {
        title: 'a type-only import in a facade',
        tree: {
          'features/catalog/facades/useList.ts': ts(
            "import type { Effect } from 'effect';",
            'export type X = Effect.Effect<1>;',
          ),
        },
      },
    ],
    [
      importsEffect('features/catalog/domain/errors.ts'),
      importsEffect('features/catalog/data/repo.ts'),
      importsEffect('features/catalog/useCases/list.ts'),
      importsEffect('features/catalog/di/layer.ts'),
      importsEffect('features/core/runtime/runtime.ts'),
      importsEffect('features/core/error/appError.ts'),
      importsEffect('features/core/testing/itEffect.ts'),
    ],
  );

  describeRule(
    'domain-pure-except-effect',
    [
      {
        title: 'domain/ importing another npm package',
        tree: { 'features/catalog/domain/item.ts': ts("import lodash from 'lodash';", 'export const item = lodash;') },
      },
      {
        title: 'domain/ importing an @effect/* package',
        tree: {
          'features/catalog/domain/item.ts': ts("import { x } from '@effect/platform';", 'export const item = x;'),
        },
      },
    ],
    [
      importsEffect('features/catalog/domain/item.ts'),
      {
        title: 'domain/ importing an effect submodule',
        tree: {
          'features/catalog/domain/item.ts': ts("import { make } from 'effect/Runtime';", 'export const item = make;'),
        },
      },
    ],
  );

  describeRule(
    'facades-run-through-boundary',
    [
      {
        title: 'a facade importing the app runtime',
        tree: {
          'features/catalog/facades/useList.ts': ts(
            "import { runtime } from '../../core/runtime';",
            'export const useList = runtime;',
          ),
          'features/core/runtime/index.ts': ts('export const runtime = 1;'),
        },
      },
      importsEffect('features/catalog/facades/useList.ts', 'effect/ManagedRuntime'),
      importsEffect('features/catalog/facades/useList.ts', 'effect/Runtime'),
    ],
    [
      {
        title: 'a facade using useEffectQuery on a use case',
        tree: {
          'features/catalog/facades/useList.ts': ts(
            "import { useEffectQuery } from '@timothyrusso/effect-core/react';",
            "import { listItems } from '../useCases/listItems';",
            'export const useList = () => useEffectQuery(listItems);',
          ),
          'features/catalog/useCases/listItems.ts': ts('export const listItems = 1;'),
        },
      },
    ],
  );
});

describe('featuresRoot src/features', () => {
  const config: ArchKitConfig = { featuresRoot: 'src/features', appRoot: 'app' };
  const options: ArchRulesOptions = { featureTiers: { 'src/features/catalog': 1, 'src/features/reviews': 1 } };

  describeRule(
    'no-tier-violation-src-features-catalog',
    [
      {
        title: 'a Tier 1 peer import',
        config,
        options,
        tree: {
          'src/features/catalog/data/a.ts': ts("import { r } from '../../reviews';", 'export const a = r;'),
          'src/features/reviews/index.ts': ts('export const r = 1;'),
        },
      },
    ],
    [],
  );

  describeRule(
    'effect-only-in-inner-layers',
    [{ ...importsEffect('src/features/catalog/facades/useList.ts'), config, options }],
    [
      { ...importsEffect('src/features/catalog/data/repo.ts'), config, options },
      { ...importsEffect('src/features/core/runtime/runtime.ts'), config, options },
    ],
  );
});
