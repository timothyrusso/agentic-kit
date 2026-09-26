# Architecture deltas

This app follows the agentic-kit ARCHITECTURE.md and ERROR_HANDLING.md. This file lists only
what the app decides on top of them; where the two disagree, this file wins.

## Layout

`featuresRoot` is `features`, `appRoot` is `app`, and the `@/` alias points at the app root.

## Tiers

| Tier | Features |
| --- | --- |
| 0 | `core/error`, `core/config`, `core/logger`, `core/sqlite`, `core/query`, `core/state`, `core/translations`, `core/design-system`, `core/testing` |
| 1 | none yet |
| 2 | `items` |
| 3 | none yet |
| 4 | none yet |
| 5 | `core/runtime` |

## Core concerns

| Concern | What it holds |
| --- | --- |
| `core/error` | `AppErrorRegistry` and `AppError` (`appError.ts`), `errorTagToMessageKey`, `useAppErrorMessage`, `reportBootFailure`, and the kit's error classes re-exported for `domain/` |
| `core/config` | `AppConfig` from `makeConfig`, decoding `extra` in `app.json` (the Schema is in `domain/schemas/`) |
| `core/logger` | `LoggerLive`: `ConsoleLogger` in development, `NoopLogger` in release until a crash reporter Layer replaces it |
| `core/sqlite` | `SqliteLive` over expo-sqlite (foreign keys on, migrations at open) and `migrations` |
| `core/query` | `queryClient`, which does not retry app errors |
| `core/state` | `createStore`, `createSelectors`, `resetAllStores` |
| `core/translations` | the `en` and `it` catalogs, `useT`, `tr` and the language store; `MessageKey` types every key |
| `core/design-system` | tokens, the theme, `useStyles` and the shared components (`Screen`, `Text`, `Button`, `TextField`, `Spinner`, `FatalScreen`) |
| `core/testing` | `makeSqliteTestLayer`, `makeTestRuntime`, `makeTestWrapper` |
| `core/runtime` | the app Layer, the one runtime and the `Register` augmentation |

Effect code in a core concern lives in that concern's `domain/`, `data/` or `di/`, unless the
concern is `core/runtime`, `core/error` or `core/testing`.

## Views and copy

- `lint.allowedHooksInViews` is `useStyles` and `useTheme`. Translated copy reaches a view through
  its ViewModel's `derived`, since a view may not import `core/translations`
  (`tsx-no-cross-feature-public-api`).
- `lint.layoutTokens` is on: the gutter is `screenGutter` (`theme.gutter` in styles), the spacing
  scale is `spacing` in `features/core/design-system/tokens.ts`, and `layout.allow` is empty.
- `lint.singleSpinner` is on: `Spinner` from the design system is the only spinner.

## Tests

- Use case tests build fakes from the Tag (`useCases/__tests__/`); Live Layer tests run on
  `makeSqliteTestLayer()`, a migrated in-memory `node:sqlite` database
  (`data/repositories/__tests__/`).
- Facade and page tests build a runtime with `makeTestRuntime(FeatureLive)` and render through
  `makeTestWrapper(runtime)`. They are `.test.ts` files that use `createElement`: a `.tsx` there
  would fall under the view rules.
- `jest.config.cjs` adds two deltas to the kit preset: `@timothyrusso/*` is transformed (it ships
  ES modules) and `__fixtures__/` is never a test root. `tsconfig.json` sets `types: ["jest"]`,
  which TypeScript 6 no longer includes by default.

## Rule fixtures

`__fixtures__/violations/` is a small app of deliberate violations, one or more per kit rule.
Biome, ESLint, tsc, jest and the architecture check of the app skip it; `npm run arch:fixtures`
runs `npm run arch` there, requires it to fail, and checks that exactly the enabled kit rules
fire. Add a fixture when the kit adds a rule.
