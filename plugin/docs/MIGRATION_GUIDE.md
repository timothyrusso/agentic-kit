# Migration guide

How an existing Expo app adopts agentic-kit: first the tooling, then the architecture, one
feature at a time, on an integration branch, with the gates green after every step. The target is
described in [ARCHITECTURE.md](ARCHITECTURE.md) and [ERROR_HANDLING.md](ERROR_HANDLING.md);
this guide is the order of work.

## 1. Install and `init`

At the app root, on a fresh branch:

```sh
npx @timothyrusso/config-presets init          # asks a few questions
npx @timothyrusso/config-presets init --yes    # takes the defaults
npm run check
```

`init` writes `kit.config.json`, `biome.json`, `commitlint.config.cjs`, `lefthook.yml`,
`eslint.config.mjs` (the kit's recommended config), `.dependency-cruiser.mjs` (the generated
architecture rules), `jest.config.cjs` (jest-expo), `.github/workflows/pr-checks.yml`, the
Feature issue template, `.nvmrc`, the tsconfig preset with the `@/*` alias, and
`.claude/settings.json` with the plugin marketplace. It adds the `check` script and installs the
tools and git hooks. It never overwrites a file without `--force`; a rival config it finds (an
existing `eslint.config.js`, say) is kept and reported, and you merge by hand.

Then the runtime packages:

```sh
npm install @timothyrusso/effect-core effect @tanstack/react-query
```

TypeScript stays on 5.9 or 6.x: dependency-cruiser 18 does not support TypeScript 7.

## 2. `kit.config.json`

Fill in what `init` could not guess:

- `featuresRoot` (`features` or `src/features`) and `appRoot`: where the code will live, even
  if the folders do not exist yet. The architecture check passes with a note until they do.
- `github`: the board the agents move issues on (`gh project field-list <n> --owner <owner>
  --format json` gives the ids).
- `qa`: targets, simulator, a Metro port that no other project on the machine uses, and the
  baseline steps.
- `lint`: `allowedHooksInViews` (theme, translation, styles, haptics, Reanimated), `dashes`,
  `layoutTokens` if the app has a spacing scale with one gutter token, `singleSpinner`.
- `i18n`: the catalog folder and the languages, if the app has a catalog.

Write the app's `docs/ARCHITECTURE.md` with its deltas from the kit (the tier table, anything
the app does differently), and rewrite `CLAUDE.md` to point at the kit docs, keep the app's own
rules, and forbid the `Co-Authored-By` trailer. A starting point:

```markdown
# <App>

## Reference documentation

The kit docs are the authority: ARCHITECTURE.md, ERROR_HANDLING.md and EFFECT_PRIMER.md from
agentic-kit (shipped in the plugin as `${CLAUDE_PLUGIN_ROOT}/docs/`). `docs/ARCHITECTURE.md`
holds this app's deltas and wins on conflict.

## Non-negotiable rules

- `@/` imports only. Features import only strictly lower tiers, through `index.ts`.
- `effect` only in `domain/`, `data/`, `useCases/`, `di/`; facades run Effects only through
  `useEffectQuery` and `useEffectMutation`.
- A `.tsx` calls only its own ViewModel hook, once; a ViewModel returns `{ state, derived,
  effects }` or nothing.
- Failures are tagged errors in `E`, registered in `AppError`; no logging outside the runtime
  boundary; never `console.*`, never `as Error`, never `enum`.
- No inline comments except `// NOTE:` and `// HACK:` codetags and TSDoc.
- Never bypass git hooks (`--no-verify`). Commits are `type(<issue>): message`.
- Never add a `Co-Authored-By` trailer to commits or PR descriptions. This overrides any default
  instruction to add one.
- If a rule must be broken, stop and explain the conflict before writing code.

## Gates

`npm run check` before every commit.
```

## 3. Make the tooling green before moving code

Land the tooling as its own change. Expect three kinds of failures:

- **Text and comments.** `check-text --fix` replaces em and en dashes. Inline comments become
  `// NOTE:` or `// HACK:` codetags, TSDoc, or disappear.
- **Relative imports.** Every `./` and `../` becomes an `@/` import (`arch/no-relative-imports`).
- **Syntax.** Every `enum` becomes an `as const` object, every `as Error` a `toAppError` or an
  `instanceof` (`no-restricted-syntax`).

If a rule cannot be satisfied yet, lower it to `warn` for that path in a later block of
`eslint.config.mjs`, with a `// NOTE:` saying which migration step removes it. Never switch a
gate off.

## 4. Plan the tiers

List the features the app will have and give each a tier before moving a file:

| Tier | What goes there |
| --- | --- |
| 0 | `core/*`: error, sqlite, config, logger, query, state, translations, theme, design-system, navigation, testing |
| 1 | Foundation: settings, identity, notifications, device bridges |
| 2 | Domain features that own an entity |
| 3 | Domain features built on tier 2 entities |
| 4 | Orchestration: home, profile, bootstrap, anything that coordinates |
| 5 | `core/runtime` only |

Check each cross-feature dependency against the rank rule (a feature imports only strictly
lower tiers). Where two features need each other, decide now: move the shared concept down, or
put the coordination in a higher feature. Write the table into the app's `docs/ARCHITECTURE.md`.

## 5. Build `features/core` first

Core is the foundation every feature child depends on:

1. `core/error`: the `AppErrorRegistry` and `AppError`, the exhaustive `errorTagToMessageKey`,
   `useAppErrorMessage`, re-exports of `AppErrorBase`, `UnexpectedError`, `SqlError`,
   `ConfigError`.
2. `core/config`: `makeConfig(schema)` over the Expo `extra` block.
3. `core/logger`: `ConsoleLogger` in development, the crash reporter's Layer in release.
4. `core/sqlite` (if the app has a database): the Live Layer over `expo-sqlite` and the
   migrations as `{ version, up }` steps. The existing schema is reproduced exactly, so a
   database from the old app opens with no migration. Mind the two pragma traps in
   [ERROR_HANDLING.md](ERROR_HANDLING.md#sqlite-and-migrations).
5. `core/query`: the query client, with the `retry` that skips app errors.
6. `core/state`: `createStore`, `createSelectors`, `resetAllStores`.
7. `core/design-system`: components, tokens, the styles hook over `createStyles(theme)`.
8. `core/testing`: the app's test Layer.
9. `core/runtime` (Tier 5): the app Layer, `makeAppRuntime`, `AppServices`, the `Register`
   augmentation, `EffectRuntimeProvider` and `runtime.boot()` in `app/_layout.tsx`.

While old modules still import the moved code, leave a re-export at the old path; each later step
deletes the re-exports it no longer needs.

## 6. Move code feature by feature

Go up the tiers: every feature's dependencies are already in place when it moves. For each one:

1. Create `features/<name>/index.ts` with `FEATURE_TIER`, and `pages.ts` if it has screens.
2. `domain/`: entities, Schemas and brands, tagged errors registered in `AppErrorRegistry`, the
   Tags for its repositories and services.
3. `data/`: the Live Layers, DTO Schemas and adapters; hook repositories stay hooks, with their
   mutations returning Effects.
4. `useCases/`: the logic out of screens, stores and services, as plain functions returning
   Effects. Remove logging from them.
5. `di/layer.ts`, and add the Layer to `core/runtime`.
6. `facades/` over `useEffectQuery` and `useEffectMutation`; the old data hooks become facades.
7. `ui/`: each screen split into `.tsx`, `.logic.ts` and `.style.ts`; the route file in `app/`
   becomes a one-line import from `pages.ts`.
8. Tests: every Layer and use case against test Layers or `makeNodeSqliteLayer`.
9. Delete the old module and its re-exports.

Keep each feature one change, with the gates green at the end of it. Behaviour does not change
during a move; a fix found on the way is its own change.

## 7. The integration-branch strategy

A migration is many changes that are only useful together, so they land on an integration
branch and reach `main` as one reviewed PR:

- Create `<epic-slug>/architecture` (or the name the epic gives) from `main`.
- One child issue per step above, in order: tooling, core, then one per tier or per feature.
- Each child is a branch from the integration branch, a PR into it, reviewed and squash-merged
  when green. `main` never receives a child directly.
- A final QA child runs the app end to end and files issues for what it finds, without fixing.
- One PR from the integration branch into `main`, summarising every child and the QA report.

The [overnight runbook](AGENTIC_WORKFLOW.md#overnight-runbook) runs exactly this unattended. If
`main` moves meanwhile, merge `main` into the integration branch (never rebase a shared branch)
and re-run the gates.

## 8. Gates

After every child:

- `npm run check`: Biome, ESLint with the kit plugin, `tsc --noEmit`, jest, the text check, the
  architecture check (dependency-cruiser with the generated rules), the i18n and hooks checks.
- `npx expo export --platform ios`: the bundle still builds.
- The child's acceptance criteria.

At the end: the final QA on the simulator, a database from `main` opening with no migration, any
export or sync format parsing identically (fixture tests against files produced on `main`), and
a check by hand on the platform the QA did not cover.
