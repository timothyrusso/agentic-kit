# expo-kit-template

An Expo SDK 57 app already wired to [agentic-kit](https://github.com/timothyrusso/agentic-kit):
expo-router, TanStack Query, zustand, Effect and expo-sqlite, the kit's presets and rules, git
hooks, CI and the Claude Code plugin. It needs agentic-kit 0.1.0 or later
(`@timothyrusso/*` on npm).

## Start an app

1. **Use this template** on GitHub, then clone the new repository.
2. Rename it: `projectName` in `kit.config.json`, `name` in `package.json`, and `name`, `slug`
   and `scheme` in `app.json`.
3. `npm install` (it also installs the git hooks), then `npm run check`.
4. `npx expo start --port 8082`.

Fill in `github` and `qa.baseline` in `kit.config.json` before running the plugin's pipeline.

## What is in it

- `features/core/*`: the core concerns (error, runtime, config, logger, sqlite, query, state,
  translations, design-system, testing).
- `features/items`: a Tier 2 sample feature with every layer: a repository Tag and its SQLite
  Layer, use cases, facades over `useEffectQuery` and `useEffectMutation`, a zustand store, and a
  page with its `.logic.ts` ViewModel and `.style.ts`, each layer with a test.
- `__fixtures__/violations`: one deliberate violation per kit rule, checked by
  `npm run arch:fixtures`.

## Scripts

| Script | What it runs |
| --- | --- |
| `npm run check` | Biome, ESLint, tsc, the text check, the architecture rules, the catalog checks and jest |
| `npm run arch` | The architecture rules alone: dependency-cruiser and the kit's ESLint rules |
| `npm run arch:fixtures` | `npm run arch` on the fixtures, which must fail with exactly the kit's rules |
| `npx expo export --platform ios` | The iOS bundle, as CI builds it |

`CLAUDE.md` and `docs/ARCHITECTURE.md` hold the rules and the app's deltas from the kit docs.

This repository is generated from `template/` in agentic-kit by `npm run template:sync`; change
the template there.
