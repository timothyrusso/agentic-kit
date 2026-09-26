# Architecture

The shared architecture of every app built on agentic-kit: feature modules, integer tiers,
layers, Effect in the inner layers only, and the ViewModel contract in the UI. Each app keeps a
short `docs/ARCHITECTURE.md` with its deltas only; where the two disagree, the app's deltas win.

Code examples use generic names (`Item`, `ItemRepository`, `listItems`, `useItems`). They show
the patterns and the rules, they are not templates to copy. The folder that holds the features
is `featuresRoot` in `kit.config.json` (`features` or `src/features`) and the expo-router folder
is `appRoot` (`app` by default); this document writes `features/` and `app/`.

Read [ERROR_HANDLING.md](ERROR_HANDLING.md) before writing any code that can fail, and
[EFFECT_PRIMER.md](EFFECT_PRIMER.md) if Effect is new to you.

## Guiding principles

- **Feature first.** Code is grouped by business capability, not by technical layer. Open a
  feature folder and you see its whole scope.
- **Dependencies point inward.** `ui` to `facades` / `hooks` / `state` to `useCases` to `domain`,
  never the reverse.
- **The compiler is the reviewer.** Effect is used where tsc can then check something a human
  would otherwise have to: every service a use case needs is provided, every failure is a member
  of the closed `AppError` union, parsers and types cannot drift, test doubles are Layers.
- **Effect stays inside.** `domain/`, `data/`, `useCases/` and `di/` use Effect. `ui/`,
  `facades/`, `hooks/`, `state/` and `app/` never import it; facades hand Effects to two hooks.
- **Feature isolation.** Features talk only through another feature's `index.ts` and only
  downward in the tier order. Internal folders are never imported across features.
- **Start simple, promote when needed.** Components, facades and hooks start local and move to a
  shared place when a second consumer appears.
- **Rules are mechanical.** Every rule that can be checked is checked by dependency-cruiser
  (`@timothyrusso/arch-rules`) or ESLint (`@timothyrusso/eslint-plugin-arch`). The
  [rules table](#rules-table) lists every rule id. What no rule can see, the reviewer checks.

## Feature module structure

Only create the folders a feature needs.

```text
features/<name>/
├── domain/
│   ├── entities/        plain types and constants
│   ├── errors/          Data.TaggedError classes (AppErrorBase)
│   ├── schemas/         effect Schema definitions, brands
│   ├── repositories/    Context.Tag declarations for data access
│   ├── services/        Context.Tag declarations for capabilities
│   └── utils/           pure functions over domain types
├── data/
│   ├── dtos/            wire shapes and their Schemas
│   ├── adapters/        DTO to entity
│   ├── repositories/    Live Layers for repository Tags, or hook repositories
│   └── services/        Live Layers for service Tags
├── mappers/             domain value to presentation value
├── libraries/           thin wrappers around third-party libraries
├── useCases/            plain functions returning Effect<A, E, R>
├── di/
│   └── layer.ts         the feature's Layer: every Live Layer it provides
├── facades/             hooks that run use cases through useEffectQuery / useEffectMutation
├── hooks/               feature utility hooks, no data access
├── state/               zustand stores
├── ui/
│   ├── components/
│   └── pages/
├── index.ts             public API, declares FEATURE_TIER
└── pages.ts             router entry: page components only
```

## `features/core/`

`features/core/` holds the cross-cutting concerns. It is organised by concern, and each concern
is a feature of its own, with its own layers, `index.ts` and tier.

```text
features/core/
├── error/           AppError, UnexpectedError, toAppError, errorTagToMessageKey, useErrorMessage
├── runtime/         the app Layer and the one ManagedRuntime (the composition root)
├── config/          the Config service (makeConfig)
├── logger/          the Logger Layers
├── sqlite/          the SqliteClient Live Layer and the migrations
├── state/           createStore, createSelectors
├── design-system/   components, tokens, createStyles helpers
├── navigation/      route helpers
├── testing/         the test Layers
└── ...
```

A core concern follows the same layer structure as any feature, only with the layers it needs.

Features are isolated: `features/items/` never reaches into `features/catalog/`. When logic or a
type is needed across features, it either moves into the right `features/core/<concern>/`, or is
exposed through the owning feature's `index.ts`, and only downward in the tier order.

### What a feature's public API (`index.ts`) exports

| Can export | Why |
| --- | --- |
| `FEATURE_TIER` | Required: the tier rules are generated from it |
| Domain entities and types | Consumers type the data they receive |
| Facades | Ready hooks that expose data and actions |
| Utility hooks | Hooks genuinely useful to other features |
| The feature's Layer (`ItemsLive` from `di/layer.ts`) | Only `core/runtime` imports it |
| Tags other features' use cases need | A lower-tier service a higher-tier use case depends on |

| Must not export | Why |
| --- | --- |
| Page components | They belong in `pages.ts` |
| Hook repositories, DTOs, adapters, validators | Internal data access and wire formats |
| Use cases | Internal; other features reach them through facades |
| State stores | Another feature has no business reading or writing them |
| `libraries/` wrappers | An implementation detail |
| UI components | Promoted to `features/core/design-system/` when truly shared |
| Individual Live Layers | Only the feature's merged Layer leaves the feature |

```ts
// features/catalog/index.ts
import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 2;
export type { Catalog } from '@/features/catalog/domain/entities/Catalog';
export { useCatalogStatus } from '@/features/catalog/facades/useCatalogStatus';
export { CatalogLive } from '@/features/catalog/di/layer';
```

Core concerns may also export their Tags and small Effect helpers (`withSqlite`, `Clock`), since
every feature's inner layers build on them.

Every import into a feature from outside goes through its `index.ts`, its `pages.ts` or its
`assets/` folder: `enforce-index-boundary-<feature>` (one rule per feature, for example
`enforce-index-boundary-features-catalog`) fails any other path.

```ts
import type { Catalog } from '@/features/catalog';              // allowed
import { useCatalogStatus } from '@/features/catalog';          // allowed
import { CatalogPage } from '@/features/catalog/pages';         // allowed from app/ only, by convention
import { catalogRepo } from '@/features/catalog/data/repositories/catalogRepositoryLive'; // enforce-index-boundary-features-catalog
```

### When to use `core/` and when `index.ts`

| Scenario | Solution |
| --- | --- |
| Infrastructure many features need (logging, storage, HTTP, errors) | A `features/core/<concern>/` |
| A type or facade one other feature needs | The owning feature's `index.ts`, if the consumer is in a higher tier |
| A UI component many features need | `features/core/design-system/` |
| A UI component one other feature needs | Ask whether it needs the component or only the data. Promote the component to the design system if it is truly shared; never export UI from `index.ts` |
| The consumer is a same-tier peer | Not allowed. Move the concept to a lower tier or add a higher-tier feature that coordinates both |

## Feature tiers

Every feature sits at a tier, an integer from 0 to 5, declared in its `index.ts`:

```ts
import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 2;
```

**The rank rule: a feature imports only features of a strictly lower tier. Tier 0 may also import
Tier 0.** Peers never import each other, and nothing imports upward. `@timothyrusso/arch-rules`
reads every `FEATURE_TIER` (features one and two levels under `featuresRoot`, so
`features/<name>` and `features/core/<concern>`) and generates one `no-tier-violation-<feature>`
rule per feature, for example `no-tier-violation-features-orders`. A tier outside 0..5 fails the
config build with `FeatureTierError`. Type-only imports count: a peer's type is still a peer
dependency.

The usual ladder:

| Tier | Role | Examples |
| --- | --- | --- |
| 0 | Core: infrastructure, no business logic | `core/error`, `core/sqlite`, `core/design-system` |
| 1 | Foundation: cross-cutting, no app-specific entity | `settings`, `identity`, `notifications` |
| 2 | Domain: owns an entity specific to this app | `catalog`, `items` |
| 3 | Domain built on domain: owns an entity that uses tier 2 entities | `orders` |
| 4 | Orchestration: coordinates features, owns no entity | `home`, `checkout-flow`, `bootstrap` |
| 5 | Reserved for `core/runtime`, the composition root | `core/runtime` |

Apps can use fewer tiers; the only fixed points are Tier 0 for core concerns and Tier 5 for
`core/runtime`.

### Why `core/runtime` is Tier 5

The runtime's Layer has to include every feature's Layer, so it must be able to import every
feature. Declaring `core/runtime` at the top tier makes that legal, and has a second effect that
is the point: no feature can import `core/runtime`, because every feature is below it. Only
`app/` (outside the tier graph) imports it, to mount the provider. Facades are additionally
barred from it by `facades-run-through-boundary`. Tier 5 is used by `core/runtime` alone.

### Classifying a feature

```text
Is it pure infrastructure with no business logic?          yes: Tier 0
Does it coordinate features without an entity of its own?  yes: the orchestration tier
Does it model something specific to what this app does?    yes: a domain tier (2, or 3 if it builds on another domain feature)
Otherwise                                                   Tier 1
```

### Design smells

| Symptom | Cause | Fix |
| --- | --- | --- |
| A lower tier needs something from a higher one | The lower feature is misclassified | Reclassify it |
| Two peers need each other | A shared concept has no owner | Move the concept down, or add a coordinator above both |
| A domain feature needs the orchestration tier | The coordinator owns something it should not | Move that concept into its own domain feature |

Resolve the classification; never work around a tier rule by moving imports around.

## Folder purposes

### `domain/`

The core of the feature: plain TypeScript plus `effect`, nothing else from `node_modules`
(`domain-pure-except-effect`). No React, no SDK, no `@effect/*` package, no side effects.
`domain/` never imports an outer layer or `design-system/` (`domain-no-outer-layer-import`),
and never imports runtime values from another feature's `index.ts`
(`domain-no-cross-feature-runtime-import`; `features/core/error` is the default exception).
Because `@timothyrusso/effect-core` is a `node_modules` package too, `domain/` reaches the kit's
error pieces (`AppErrorBase`, `SqlError`, `UnexpectedError`) through `features/core/error`,
which re-exports them.

#### `domain/entities/`

Plain types in the app's own language, not an external API's.

- `interface` for entity shapes; `type` for unions, intersections and component props.
- No TypeScript `enum` (`no-restricted-syntax`): use an `as const` object and its value union.

```ts
export const CategoryLevel = { Basic: 'Basic', Premium: 'Premium' } as const;
export type CategoryLevel = (typeof CategoryLevel)[keyof typeof CategoryLevel];
```

When an entity's type is derived from a Schema, the Schema is the source and the type is
`typeof ItemSchema.Type`.

#### `domain/errors/`

One `Data.TaggedError` class per failure mode, declared with `AppErrorBase` from
`@timothyrusso/effect-core`, and the registration of the feature's errors in the app's closed
union. See [ERROR_HANDLING.md](ERROR_HANDLING.md).

#### `domain/schemas/`

`effect` Schemas: what valid data looks like, the branded ids (`ItemId`), and the types derived
from them. Schemas are domain: the rules live here, and `data/` runs them on untrusted input.

#### `domain/repositories/` and `domain/services/`

The `Context.Tag` declarations: the contract, with no implementation. A repository Tag is data
access for the feature's own entities; a service Tag is a capability (a clock, haptics, a watch
bridge, an AI client).

```ts
// features/items/domain/repositories/ItemRepository.ts
import { Context, type Effect } from 'effect';
import type { SqlError } from '@/features/core/error';
import type { Item, ItemId } from '@/features/items/domain/entities/Item';

export class ItemRepository extends Context.Tag('items/ItemRepository')<
  ItemRepository,
  {
    readonly list: Effect.Effect<readonly Item[], SqlError>;
    readonly byId: (id: ItemId) => Effect.Effect<Item | undefined, SqlError>;
    readonly save: (item: Item) => Effect.Effect<void, SqlError>;
  }
>() {}
```

The Tag's key is `<feature>/<Name>`, which keeps two apps' Tags from colliding in one test.

#### `domain/utils/`

Pure functions over domain types, used by more than one layer. If one layer uses it, it lives in
that layer.

### `data/`

The infrastructure layer: it implements the Tags from `domain/` as Layers and owns every
external concern (SQLite, HTTP, SDKs, device storage). It imports `domain/`; `domain/` never
imports it.

- `data/dtos/`: the wire shapes, as Schemas, so decoding a response and typing it are one step.
- `data/adapters/`: DTO to entity. A Schema transform when the mapping is one to one, a plain
  function otherwise.
- `data/repositories/` and `data/services/`: the Live Layers. `ItemRepositoryLive` builds the
  service from the Tags it depends on (`SqliteClient`, `Config`) with `Layer.effect`.

```ts
// features/items/data/repositories/itemRepositoryLive.ts
export const ItemRepositoryLive = Layer.effect(
  ItemRepository,
  Effect.gen(function* () {
    const db = yield* SqliteClient;
    return {
      list: trySql('list items', () => db.getAllAsync<ItemRow>('SELECT * FROM items')).pipe(
        Effect.flatMap(Schema.decodeUnknown(Schema.Array(ItemFromRow))),
        Effect.mapError(toAppError),
      ),
      byId: id => ...,
      save: item => ...,
    };
  }),
);
```

A Live Layer never logs and never catches to hide a failure: it fails with a tagged error and
lets the boundary decide.

#### Hook repositories (hook-only SDKs)

Some SDKs expose their API only as React hooks: a reactive backend whose queries are
subscriptions, or an auth SDK whose calls need a provider context. Forcing them into a Layer
would lose reactivity or context, so they stay hooks: `data/repositories/useItemRepository.ts`,
typed by an interface in `domain/repositories/`.

- Reactive reads stay plain hook values (`undefined` while loading). No Effect.
- Mutations are wrapped as Effects at the mutation boundary, and only there: the hook repository
  returns functions that return `Effect.tryPromise({ try, catch: toAppError })`, and the facade
  hands them to `useEffectMutation`. The facade still imports no `effect`.

```ts
// features/items/data/repositories/useItemRepository.ts
export const useItemRepository = (): ItemHookRepository => {
  const items = useQuery(api.items.list);
  const create = useMutation(api.items.create);
  return {
    items,
    create: input => Effect.tryPromise({ try: () => create(input), catch: toAppError }),
  };
};
```

### `mappers/`

Pure functions from a domain value to a presentation value (a catalog key, a label, a colour
token). They import only `domain/`; `.logic.ts`, facades and hooks import them. They are not in
`domain/`, because a presentation key there would couple the domain to the UI, and not in
`data/adapters/`, which go the other way (external to domain).

### `libraries/`

Thin wrappers around third-party libraries, when swapping the library would otherwise touch more
than one file. Only `data/` imports them. Do not wrap type-only imports, React Native built-ins,
or libraries that are already the abstraction (TanStack Query).

### `useCases/`

Application logic: plain exported functions returning `Effect<A, E, R>`. No classes, no
container, no constructor injection. What a use case needs appears in its `R`; how it can fail
appears in its `E`.

```ts
// features/items/useCases/listActiveItems.ts
export const listActiveItems = Effect.gen(function* () {
  const repo = yield* ItemRepository;
  const now = yield* Clock.currentTimeMillis;
  const items = yield* repo.list;
  return items.filter(item => isActive(item, now));
});
// Effect<readonly Item[], SqlError, ItemRepository>

export const renameItem = (id: ItemId, name: string) =>
  Effect.gen(function* () {
    const repo = yield* ItemRepository;
    const item = yield* repo.byId(id);
    if (item === undefined) return yield* new ItemNotFound({ itemId: id });
    yield* repo.save({ ...item, name });
  });
```

- Use cases import `domain/` (Tags, entities, errors), never `data/` (`usecases-no-data-import`):
  the concrete Layer is chosen by the runtime, not the use case.
- Use cases do not log. The runtime boundary logs each failure once.
- A use case may take a plain function or another Effect as a parameter (a hook repository's
  mutation), which keeps it testable without a Tag.

#### What earns a Tag

Only things with more than one implementation: the real one and the test one, or two real ones.
Repositories, the SQLite client, the watch bridge, the clock (Effect's own `Clock`), the logger,
config, haptics, notifications, an HTTP client. A pure calculation, a formatter or a use case is
a plain function: it needs no Tag, because there is nothing to swap. If a test would have to mock
it, it earns a Tag; if the test can call it, it does not.

### `di/`

`di/layer.ts` merges every Live Layer the feature provides into one Layer, exported from
`index.ts` for `core/runtime`:

```ts
// features/items/di/layer.ts
export const ItemsLive = Layer.mergeAll(ItemRepositoryLive, ItemSyncLive);
```

A feature Layer may leave core services open (`SqliteClient`, `Config`); `core/runtime`
provides them. `di/` holds no container, no singletons and no module-level side effects.

### `facades/`

Facades are coordination hooks, named `useXxx`. They run use cases through `useEffectQuery` and
`useEffectMutation` from `@timothyrusso/effect-core/react`, combine them with hook repositories
and same-feature state, and decide how a failure surfaces (toast, inline, boundary).

```ts
// features/items/facades/useActiveItems.ts
export const useActiveItems = () =>
  useEffectQuery({ queryKey: ['items', 'active'], queryFn: listActiveItems });

// features/items/facades/useRenameItem.ts
export const useRenameItem = (id: ItemId) => {
  const queryClient = useQueryClient();
  return useEffectMutation({
    mutationFn: (name: string) => renameItem(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });
};
```

- A facade imports no `effect` (`effect-only-in-inner-layers`), never touches the runtime
  (`facades-run-through-boundary` for `core/runtime` and the `ManagedRuntime` modules), and never
  calls `.runPromise`, `.runSync`, `.runFork` or `.runCallback` (`arch/no-effect-run-in-facades`).
- The hooks accept only `Effect<A, AppError, AppServices>`: a use case needing a service the
  runtime does not provide, or failing with an error outside the union, does not compile.
- Facades do not log; the boundary already did.
- Every hook repository access lives in a facade. A facade used by one page may stay in that
  page's `.logic.ts` until a second page needs it; promote it to `facades/` then, or at once when
  the composition is worth a name.
- A facade reused by other features is exported from `index.ts`; one reused across many moves to
  a `core/<concern>/facades/`.

### `hooks/`

Feature utility hooks: stateful or derived logic reused across pages, with no data access. They
do not import `data/repositories/`, `useCases/` or `di/`, and do not fail. A hook several
features need moves to `features/core/<concern>/hooks/`.

### `state/`

Client-only state in zustand stores: wizard inputs, filters, flags. Server data is owned by
TanStack Query through the facades, never copied into a store.

- Stores are created with `createStore` and exposed with `createSelectors`, both from
  `features/core/state`. `createSelectors` runs once at module level; each selector subscribes to
  one key.
- A store action is one `set()` and nothing else. Filtering, sorting and capping belong in a use
  case; the facade writes the result.
- State is written by the layer that owns the decision: a facade after an operation, a
  `.logic.ts` for pure UI state.
- A persisted store declares `name` (stable), `version`, `migrate` and an explicit `partialize`,
  and uses the storage adapter from `core/state`.
- Every store singleton registers for the global reset (`resetAllStores` on sign-out); test
  factories do not.
- `state/` imports no `effect` (`effect-only-in-inner-layers`).

| State | Location |
| --- | --- |
| A feature's wizard inputs and UI flags | `features/<name>/state/` |
| App-wide theme, language | `features/core/state/` or the concern that owns it |
| `createStore`, `createSelectors`, `resetAllStores` | `features/core/state/` |

### `ui/` and the ViewModel contract

Components and pages. Each one that has logic is three files:

```text
ItemListPage/
├── ItemListPage.tsx        JSX only
├── ItemListPage.logic.ts   the ViewModel: a hook with all state, handlers and derived data
└── ItemListPage.style.ts   createStyles(theme)
```

What a `.tsx` may import is narrow, and dependency-cruiser checks it across the graph:

- its ViewModel (`.logic.ts`), UI components, styles, and the design system;
- `import type` from `domain/` for prop annotations (`tsx-no-runtime-domain-import` fails a
  runtime import);
- never `facades/`, `data/`, `useCases/`, `di/`, `state/`, `hooks/`, `libraries/` or `mappers/`
  (`tsx-no-direct-layer-import`);
- never runtime values from another feature's `index.ts` (`tsx-no-cross-feature-public-api`):
  cross-feature values flow through the ViewModel. Route files in `app/` are exempt, and so are
  `core/navigation` and `core/design-system` by default (`tsxPublicApiExceptions`);
- never `effect` or `@effect/*`, type-only included (`arch/no-effect-in-views` on the line, and
  `effect-only-in-inner-layers` across the graph).

**The return shape** (`arch/viewmodel-return-shape`, every `*.logic.ts`). A ViewModel returns
nothing, or an object whose keys are a non-empty subset of `state` (what the view renders as
is), `derived` (values computed from state) and `effects` (handlers). Spreads and computed keys
are rejected, because they cannot be checked.

```ts
return {
  state: { items, isLoading },
  derived: { countLabel },
  effects: { select, rename },
};
```

**One ViewModel per view** (`arch/prefer-viewmodel`, every `*.tsx`). A `.tsx` that imports its
sibling `.logic` module (same basename) calls only that ViewModel hook, at most once. Any other
hook call is reported, unless its name is in `lint.allowedHooksInViews` in `kit.config.json`.
That list is for hooks that are genuinely view concerns: the theme, the translation function,
haptics, Reanimated's `useAnimatedStyle`, the styles hook. A `.tsx` with no `.logic` import is
presentational and exempt, and so are test files.

```json
{ "lint": { "allowedHooksInViews": ["useTheme", "useT", "useStyles", "useAnimatedStyle"] } }
```

**Styles are `createStyles(theme)`.** `Name.style.ts` exports a function from the theme to a
`StyleSheet`, not a static `StyleSheet.create`, so every colour and spacing value comes from the
theme's tokens. The design system's styles hook memoises the result per theme object, so a view
gets the same style object on every render until the theme changes:

```ts
// ItemListPage.style.ts
export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.gutter },
  });

// ItemListPage.tsx
const styles = useStyles(createStyles);
```

**Stable row handlers** (`arch/stable-row-handlers`). In a file that renders a `FlashList` or a
`FlatList`, a function passed to a row component (the element `renderItem` returns) or to a
`memo` component is a `useCallback` result or a module-level function, and takes the row's id.
An inline arrow, a function expression, a `.bind()` or a function declared in the component
body is reported: it is a new function per render and defeats the row's `memo`. Props and
ViewModel members (`effects.select`) pass, since their stability is checked where they are made.

```tsx
<ItemRow item={item} onSelect={effects.select} />      // allowed: select(id) from the ViewModel
<ItemRow item={item} onSelect={() => select(item.id)} /> // arch/stable-row-handlers
```

**Other view rules.** JSX text starting with `//` or `/*` is text, not a comment, and crashes at
runtime in React Native (`arch/no-jsx-comment-text`). When `lint.layoutTokens` is set, a
horizontal padding or margin in `app/` and the design system is never a literal number other
than 0 and never the non-gutter spacing token (`arch/no-literal-gutter`; the allowlist file
exempts chart internals). When `lint.singleSpinner` is on, `ActivityIndicator` from
`react-native` is forbidden outside the design system (`no-restricted-imports`), so the app has
one spinner.

Components start in the feature that needs them and move to `features/core/design-system/` when
a second feature needs them. Check the design system before building a new one.

## Services, Layers and the runtime

This replaces a DI container. There is no container, no decorators, no resolve step.

| Piece | Where | What it is |
| --- | --- | --- |
| Tag | `domain/repositories/`, `domain/services/` | The contract: `class ItemRepository extends Context.Tag(...)` |
| Live Layer | `data/repositories/`, `data/services/` | The implementation, built from the Tags it needs |
| Feature Layer | `di/layer.ts` | `Layer.mergeAll` of the feature's Live Layers, exported from `index.ts` |
| Core Layers | `core/logger`, `core/config`, `core/sqlite`, ... | `ConsoleLogger`, `ConfigLive`, `SqliteLive` |
| App Layer and runtime | `core/runtime` (Tier 5) | Every feature Layer provided with the core Layers, then `makeAppRuntime` |
| Test Layers | next to the Live Layer, or `core/testing` | `ItemRepositoryTest`, `makeNodeSqliteLayer()`, `collectLogs()` |

```ts
// features/core/runtime/runtime.ts
const CoreLive = Layer.mergeAll(ConsoleLogger, ConfigLive, SqliteLive);
const FeaturesLive = Layer.mergeAll(ItemsLive, CatalogLive, SettingsLive);

export const runtime = makeAppRuntime(FeaturesLive.pipe(Layer.provideMerge(CoreLive)));
export type AppServices = AppServicesOf<typeof runtime>;

declare module '@timothyrusso/effect-core/react' {
  interface Register {
    services: AppServices;
    error: AppError;
  }
}
```

- **One `ManagedRuntime` per app**, built once by `makeAppRuntime` in `core/runtime`. Nothing
  else creates a runtime or calls `Effect.run*` in app code; tests use `runTest` and `itEffect`.
- **`Register`** tells the two hooks what the runtime provides and what the closed error union
  is. After it, a mismatch is a compile error at the facade.
- **`app/_layout.tsx`** mounts `<EffectRuntimeProvider runtime={runtime}>` inside the
  `QueryClientProvider`, and awaits `runtime.boot()` once at startup. A Layer that fails to build
  (a missing config field, a database that does not open) is not logged by the hooks, so the boot
  call is where that failure is caught, reported and shown on the fatal screen. See
  [ERROR_HANDLING.md](ERROR_HANDLING.md#boot-failures).
- **Hook repositories** stay outside the runtime: they are React hooks. Their mutations become
  Effects inside the repository and run through `useEffectMutation` like any other.
- **Migrations** run at boot through `runMigrations` from `@timothyrusso/effect-core`, from the
  SQLite Layer or the bootstrap step. See [ERROR_HANDLING.md](ERROR_HANDLING.md#sqlite-and-migrations)
  for the two SQLite pragma traps.

## Effect placement

`effect` and `@effect/*` may be imported only from `domain/`, `data/`, `useCases/`, `di/`, and
from `core/runtime`, `core/error` and `core/testing` (`effect-only-in-inner-layers`). Never from
`ui/`, `facades/`, `hooks/`, `state/` or `app/`: the outer layers speak TanStack Query, and the
two hooks are the only bridge. `domain/` may import `effect` and nothing else from
`node_modules` (`domain-pure-except-effect`), so `@effect/*` packages belong in `data/`.

The kit's own packages are fine anywhere their entry point makes sense: `@timothyrusso/effect-core/react`
in facades, `@timothyrusso/effect-core` (errors, `withSqlite`, `Clock`) in the inner layers.

## `app/`: routing

File-based routing with expo-router. Route files are thin: they import a page from the feature's
`pages.ts` and render it, and may export an `ErrorBoundary`.

```ts
// app/items/index.tsx
export { ItemListPage as default } from '@/features/items/pages';
```

| Entry point | Consumer | Exports |
| --- | --- | --- |
| `index.ts` | Other features, `app/` | `FEATURE_TIER`, types, facades, the feature Layer |
| `pages.ts` | `app/` only | Page components |

Pages never appear in `index.ts`: a feature's `index.ts` is imported by other features, and
pages there would pull whole screens into their graph and invite cycles (`no-circular`).
`app/` may import any feature's `index.ts` and `pages.ts` (it is outside the tier graph), never
their internals, and never `effect`.

The header is the navigator's own. `app/_layout.tsx` also holds the root `ErrorBoundary`.

## Naming

| Thing | Convention | Example |
| --- | --- | --- |
| Components and pages | `PascalCase.tsx` | `ItemRow.tsx` |
| ViewModel, styles | `Name.logic.ts`, `Name.style.ts` | `ItemRow.logic.ts` |
| ViewModel hook | `useNameLogic` | `useItemListPageLogic` |
| Other files | `camelCase.ts` | `itemAdapter.ts` |
| Hooks | `useXxx.ts` | `useActiveItems.ts` |
| Entities | `Noun.ts` | `Item.ts` |
| Errors | `PascalCase` tag = class name | `ItemNotFound.ts`, tag `ItemNotFound` |
| Tags | `Noun` + `Repository` or capability | `ItemRepository.ts`, `Haptics.ts` |
| Live Layers | `camelCase` file, `XxxLive` export | `itemRepositoryLive.ts` exports `ItemRepositoryLive` |
| Test Layers | `XxxTest` | `ItemRepositoryTest` |
| Feature Layer | `<Feature>Live` in `di/layer.ts` | `ItemsLive` |
| Use cases | verb phrase, `camelCase` | `listActiveItems.ts`, `renameItem.ts` |
| DTOs | `XxxDto` Schema | `ItemDto` |
| Schemas | `XxxSchema` or `XxxFromRow` | `ItemSchema` |
| Message keys | the app catalog's convention | `errors.itemNotFound` |

## Import paths

Always the `@/` alias, never `./` or `../` (`arch/no-relative-imports`, in imports, re-exports,
`import()`, `require()` and `import('...')` types). Relative paths break when a file moves and
cannot be read at a glance. Root-level config files (`*.config.{js,cjs,mjs,ts}`) are allowed to
import their neighbours.

## Comments and text

- No inline comments except `// NOTE:` and `// HACK:` codetags, tool directives
  (`eslint-disable`, `biome-ignore`, `@ts-expect-error`, triple-slash references) and TSDoc
  `/** */` blocks leading a declaration (`arch/no-inline-comments`). Names and types carry the
  meaning; a comment is a second source of truth that drifts. Propose a codetag at planning time,
  and the reviewer lists every one a diff adds.
- Public functions, Tags and Layers get TSDoc when the name and type do not say it all.
- No em dash anywhere, and no en dash in strings, JSX text or comments (`arch/no-dashes`, on
  unless `lint.dashes` is `allow`; `check-text` in `@timothyrusso/config-presets` covers every
  other file type).
- No `as Error` cast (`no-restricted-syntax`): narrow with `instanceof`, or wrap with
  `toAppError`.

## Rules table

Every rule the kit enforces, by id. dependency-cruiser rules come from
`createArchRules(kitConfig)` in `@timothyrusso/arch-rules` and run as `npm run check:arch`;
ESLint rules come from `configs.recommended(kitConfig)` in `@timothyrusso/eslint-plugin-arch`.
[ERROR_HANDLING.md](ERROR_HANDLING.md) explains the ones about failures.

### dependency-cruiser (`@timothyrusso/arch-rules`)

| Rule id | Forbids |
| --- | --- |
| `no-tier-violation-<feature>` | A feature importing a same-tier peer or a higher tier (Tier 0 peers allowed); one per feature with something above it |
| `enforce-index-boundary-<feature>` | Importing a feature from outside other than through `index.ts`, `pages.ts` or `assets/`; one per feature |
| `tsx-no-direct-layer-import` | A `.tsx` importing `facades/`, `data/`, `useCases/`, `di/`, `state/`, `hooks/`, `libraries/` or `mappers/` |
| `tsx-no-runtime-domain-import` | A `.tsx` importing runtime values from `domain/` (`import type` is fine) |
| `tsx-no-cross-feature-public-api` | A `.tsx` outside `app/` importing runtime values from a feature `index.ts` (exceptions: `core/navigation`, `core/design-system`) |
| `domain-no-outer-layer-import` | `domain/` importing any outer layer or `design-system/` |
| `usecases-no-data-import` | `useCases/` importing `data/` |
| `domain-no-cross-feature-runtime-import` | `domain/` importing another feature's `index.ts` (exception: `core/error`) |
| `no-circular` | Circular dependencies |
| `effect-only-in-inner-layers` | `effect` or `@effect/*` outside `domain/`, `data/`, `useCases/`, `di/`, `core/runtime`, `core/error`, `core/testing` |
| `domain-pure-except-effect` | `domain/` importing anything from `node_modules` except `effect` |
| `facades-run-through-boundary` | `facades/` importing `core/runtime`, `effect/ManagedRuntime` or `effect/Runtime` |

### ESLint (`@timothyrusso/eslint-plugin-arch`, `configs.recommended`)

| Rule id | On | Forbids |
| --- | --- | --- |
| `arch/viewmodel-return-shape` | always | A `*.logic.ts` hook returning anything but nothing or `{ state?, derived?, effects? }` |
| `arch/prefer-viewmodel` | always | A `.tsx` with a ViewModel calling any other hook, or its own twice (`allow` = `lint.allowedHooksInViews`) |
| `arch/no-inline-comments` | always | Comments other than `NOTE:` / `HACK:` codetags, tool directives and leading TSDoc |
| `arch/no-jsx-comment-text` | always | JSX text starting with `//` or `/*` |
| `arch/stable-row-handlers` | always | An unstable function passed to a list row or a `memo` component |
| `arch/no-effect-in-views` | always | `effect` or `@effect/*` in a `.tsx`, type-only included |
| `arch/no-effect-run-in-facades` | always | `.runPromise`, `.runSync`, `.runFork`, `.runCallback` (and `Exit` variants) and `ManagedRuntime` in `facades/` |
| `arch/no-relative-imports` | always | `./` and `../` outside root-level config files |
| `no-restricted-syntax` | always | TypeScript `enum`; `as Error` |
| `arch/no-dashes` | `lint.dashes` is not `allow` | Em dashes anywhere; en dashes in strings, JSX text and comments |
| `arch/no-literal-gutter` | `lint.layoutTokens` is set | A literal or non-gutter horizontal padding or margin in `app/` and the design system |
| `no-restricted-imports` | `lint.singleSpinner` | `ActivityIndicator` from `react-native` outside the design system |

### Known gaps

- `domain-no-cross-feature-runtime-import` also flags type-only imports from another feature's
  `index.ts`, although its message says `import type` is fine: the rule matches the `import`
  dependency type, which a type-only import carries too. It is kept as it is for parity with the
  rules apps already run; until it changes, a `domain/` file that needs another feature's type
  takes it as a generic parameter, or the type moves to `core/`.
- `facades-run-through-boundary` sees modules, not names: it catches a facade importing
  `core/runtime` or the runtime modules, not `Effect.runPromise` on an Effect it received.
  `arch/no-effect-run-in-facades` covers the names.
- `effect-only-in-inner-layers` matches `effect` and `@effect/*`, not the kit's own
  `@timothyrusso/effect-core` root entry. A facade importing `withSqlite` from it is caught by no
  rule; the reviewer catches it. Facades import only `@timothyrusso/effect-core/react`.
- Checks that need more than one file (i18n parity, unused catalog keys, the hooks check) are
  scripts in `@timothyrusso/config-presets`, not lint rules.

## Rules

1. **Dependencies point inward.**

   | Layer | Can import | Error responsibility |
   | --- | --- | --- |
   | `.tsx` | Its ViewModel, UI components, styles, design system, `import type` from `domain/` | Renders the error state the ViewModel gives it |
   | `.logic.ts` | Facades, hooks, mappers, state, core hooks | Maps a facade's `error` to view state with `useErrorMessage`; no `try/catch`, no logging |
   | `facades/` | Use cases, hook repositories, other facades, same-feature state, `@timothyrusso/effect-core/react` | Chooses the surface: toast, inline or boundary |
   | `hooks/` | Domain types, state, library hooks | Does not fail |
   | `useCases/` | `domain/` (Tags, entities, errors, schemas) | Fails with tagged errors in `E`; never logs |
   | `data/` | `domain/`, `libraries/`, SDKs, core Tags | Maps driver errors to tagged errors; never logs |
   | `di/` | The feature's `data/` Layers | None |

2. **`domain/` is pure:** plain TypeScript and `effect` only.
3. **Effect only in the inner layers;** facades run Effects only through `useEffectQuery` and
   `useEffectMutation`.
4. **Use cases are plain functions;** only swappable things are Tags with Layers.
5. **One runtime,** in `core/runtime`, at Tier 5.
6. **Features are isolated** and import only strictly lower tiers, through `index.ts`.
7. **Pages are thin:** logic in `.logic.ts`, styles in `.style.ts` as `createStyles(theme)`.
8. **Feature state in `state/`,** built with `createStore` and `createSelectors`.
9. **Always `@/` imports.**
10. **Errors are values in `E`.** See [ERROR_HANDLING.md](ERROR_HANDLING.md).
