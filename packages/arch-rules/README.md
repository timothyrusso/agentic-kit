# @timothyrusso/arch-rules

dependency-cruiser rules for the kit's feature architecture, generated from each feature's
`FEATURE_TIER` and the app's `kit.config.json`.

## Use

```sh
npm install -D @timothyrusso/arch-rules @timothyrusso/config-presets dependency-cruiser
```

`.dependency-cruiser.js` at the app root:

```js
import { createDependencyCruiserConfig } from '@timothyrusso/arch-rules';
import { loadKitConfig } from '@timothyrusso/config-presets';

export default createDependencyCruiserConfig(loadKitConfig());
```

Then `npx depcruise features app --config .dependency-cruiser.js` (use `src/features` if that is
the app's `featuresRoot`).

`createArchRules(kitConfig, options)` returns only the `forbidden` array, for apps that keep their
own resolver options. Both read `featuresRoot` and `appRoot` from the config; `options` takes:

| Option | Default | Meaning |
| --- | --- | --- |
| `rootDir` | `process.cwd()` | App root the two folders are relative to |
| `featureTiers` | scanned | Feature path to tier, instead of reading each `index.ts` |
| `tsxPublicApiExceptions` | `core/navigation`, `core/design-system` | Features whose public API a `.tsx` may import at runtime |
| `domainPublicApiExceptions` | `core/error` | Features whose public API `domain/` may import at runtime |
| `tsConfigFile` | `tsconfig.json` | `createDependencyCruiserConfig` only |

## Tiers

Every feature declares its tier in its `index.ts`:

```ts
export const FEATURE_TIER: FeatureTier = 2;
```

Tiers are the integers 0 to 5. A feature imports only strictly lower tiers; Tier 0 (core) may
also import Tier 0. Features are found one and two levels under `featuresRoot`
(`features/<name>` and `features/core/<concern>`).

## Rules

| Rule | Forbids |
| --- | --- |
| `no-tier-violation-<feature>` | Importing a same-tier peer or a higher tier (Tier 0 peers allowed) |
| `enforce-index-boundary-<feature>` | Reaching into a feature other than through `index.ts`, `pages.ts` or `assets/` |
| `tsx-no-direct-layer-import` | A `.tsx` importing facades, data, useCases, di, state, hooks, libraries or mappers |
| `tsx-no-runtime-domain-import` | A `.tsx` importing runtime values from `domain/` (`import type` is fine) |
| `tsx-no-cross-feature-public-api` | A `.tsx` outside `appRoot` importing runtime values from a feature `index.ts` |
| `domain-no-outer-layer-import` | `domain/` importing any outer layer or `design-system/` |
| `usecases-no-data-import` | `useCases/` importing `data/` |
| `domain-no-cross-feature-runtime-import` | `domain/` importing another feature's `index.ts` |
| `no-circular` | Circular dependencies |
| `effect-only-in-inner-layers` | `effect` or `@effect/*` outside `domain/`, `data/`, `useCases/`, `di/` and `core/runtime`, `core/error`, `core/testing` |
| `domain-pure-except-effect` | `domain/` importing anything from `node_modules` except `effect` |
| `facades-run-through-boundary` | `facades/` importing `core/runtime`, `effect/ManagedRuntime` or `effect/Runtime` |

dependency-cruiser sees modules, not imported names. A facade calling `Effect.runPromise` is
already caught by `effect-only-in-inner-layers` (facades import no `effect` at all); the
name-level check belongs to the ESLint plugin.
