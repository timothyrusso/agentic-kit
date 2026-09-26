# @timothyrusso/config-presets

Everything an Expo app copies or extends to join the kit: Biome, commitlint, lefthook, tsconfig,
Jest and CI presets, the `kit.config.json` loader, the check scripts and an `init` command that
wires them all into an app.

## Init

At the root of an Expo app (for example a fresh `npx create-expo-app --template blank-typescript`):

```sh
npx @timothyrusso/config-presets init          # asks a few questions
npx @timothyrusso/config-presets init --yes    # takes the defaults, for agents and CI
npm run check
```

`init` writes `kit.config.json` and the config files, merges `package.json`, `tsconfig.json` and
`.claude/settings.json`, then installs the tools (`npm install`), `jest-expo` with `jest` and
`@types/jest` at the app's SDK versions (`npx expo install --dev`), formats what it wrote and
installs the git hooks. Nothing the app already has is overwritten without `--force`; a rival
config (say `eslint.config.js`) is kept and reported.

| Flag | Default |
| --- | --- |
| `--yes`, `-y` | ask (the defaults are also used when stdin is not a terminal) |
| `--project-name <name>` | `package.json` `name` |
| `--features-root <features\|src/features>` | `src/features` when `src/app` exists, else `features` |
| `--app-root <dir>` | `src/app` when it exists, else `app` |
| `--i18n <catalog folder\|none>` | `none` |
| `--languages <en,it>` | `en` (the first is the reference) |
| `--dashes <forbid\|allow>` | `forbid` |
| `--force` | keep what exists |
| `--no-install` | install, format and install the hooks |

On create-expo-app's untouched blank entry, `init` also rewrites `index.ts` to import `App` through
the `@/` alias without plain comments, and replaces em and en dashes in the root Markdown files
(the template's `AGENTS.md` has some), so `npm run check` passes on day one.

### What it writes

| File | Content |
| --- | --- |
| `kit.config.json` | the answers, validated against the schema |
| `biome.json` | `extends: ["@timothyrusso/config-presets/biome"]` |
| `commitlint.config.cjs` | `extends: ['@timothyrusso/config-presets/commitlint']` |
| `lefthook.yml` | copy of [`lefthook.yml`](lefthook.yml) |
| `eslint.config.mjs` | `arch.configs.recommended(loadKitConfig())` from `@timothyrusso/eslint-plugin-arch` |
| `.dependency-cruiser.mjs` | `createDependencyCruiserConfig(loadKitConfig())` from `@timothyrusso/arch-rules` |
| `jest.config.cjs` | `require('@timothyrusso/config-presets/jest')` |
| `.github/workflows/pr-checks.yml` | copy of [`github/pr-checks.yml`](github/pr-checks.yml) |
| `.github/ISSUE_TEMPLATE/feature.yml`, `config.yml` | the Feature issue template the agents parse, synced from the plugin's `templates/ISSUE_TEMPLATE/` |
| `.nvmrc` | `22` |
| `tsconfig.json` | `extends` the preset, plus the `@/*` path for Metro and Jest |
| `.claude/settings.json` | the deny list, the `agent-device` allow and the kit's marketplace, merged |
| `package.json` | the scripts below, `prepare: lefthook install` and the tools |

The ESLint and dependency-cruiser files are templates that import the sibling packages by name,
so this package depends on neither at runtime (they are optional peers).

### Scripts

```text
lint               biome check . && eslint .
typecheck          tsc --noEmit
check:text         config-presets check-text
check:arch         config-presets check-deps
check:i18n         config-presets check-i18n
check:unused-keys  config-presets check-unused-keys
check:hooks        config-presets check-hooks
test               jest --passWithNoTests
check              all of the above
```

The catalog checks print `SKIP` until `kit.config.json` has an `i18n` section, and `check:arch`
passes with a note until `featuresRoot` or `appRoot` exists, so `check` never needs editing.

## Presets

| Import | What |
| --- | --- |
| `@timothyrusso/config-presets/biome` | Biome base: formatting, the recommended rules, `noConsole`, `noExplicitAny`, native and build folders ignored, `package.json` expanded as npm writes it |
| `@timothyrusso/config-presets/commitlint` | `type(issue): message`; types `feat fix chore docs refactor test ci perf build`; the scope must be the issue number |
| `@timothyrusso/config-presets/tsconfig/expo.json` | `expo/tsconfig.base` plus `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` and `@/*` |
| `@timothyrusso/config-presets/jest` | `preset: 'jest-expo'`, `@/` mapped to the app root, tests in `__tests__/**/*.test.*` |
| `lefthook.yml` | pre-commit: Biome check and format (restaged), ESLint and the dash check on staged files; commit-msg: commitlint, the issue-number check and the dash check |
| `github/pr-checks.yml` | ubuntu: `npm ci`, commitlint over the PR's commits, the architecture check with one marker comment on the PR, `npm run check`, `npx expo export --platform ios`; macOS: a path-filtered simulator build template for native and watch targets |

TypeScript: the tools support TypeScript 5.9 and 6.x. dependency-cruiser 18 does not support
TypeScript 7, so `init` adds `typescript ~5.9.3` when the app has none and warns on 7.

## Checks

Each reads `kit.config.json` (nearest one above the working directory) and exits non-zero on a
problem.

- `check-text [files]`: no em or en dash in any file the repository tracks or would track (code,
  Markdown, JSON, YAML, Swift, ...), when `lint.dashes` is `forbid`. ESLint's `no-dashes` covers
  JavaScript and TypeScript only; this covers the rest. `--message <file>` checks a commit
  message; `--fix` replaces the dashes with hyphens.
- `check-i18n`: every key in every language of `i18n.languages`, plural pairs (`_one`, `_other`)
  complete, `{placeholder}` slots matching the first language, and no plain prose typed into JSX.
  Catalogs are `<catalogPath>/<language>.ts` (or `.js`, `.json`) exporting the catalog as the
  language code or as the default export.
- `check-unused-keys`: every key of the first language is read somewhere, as a quoted string, in
  `appRoot`, `featuresRoot` or `src`.
- `check-hooks`: no `useMemo` or `useCallback` calling `t()` without depending on it, no memoised
  component calling `tr()` instead of `useT()`.
- `check-deps [--config <file>]`: runs the app's dependency-cruiser over `featuresRoot` and
  `appRoot` with the generated architecture rules.

## Loader

```ts
import { loadKitConfig } from '@timothyrusso/config-presets';

const config = loadKitConfig(); // nearest kit.config.json, schema defaults applied
```

It throws `KitConfigError` listing every problem at once. The schema ships as
`@timothyrusso/config-presets/kit.config.schema.json`.
