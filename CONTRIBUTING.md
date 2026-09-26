# Contributing

How to work on agentic-kit itself: the gates, the conventions, adding a rule, keeping the docs
in sync, and releasing. The conventions are also in [CLAUDE.md](CLAUDE.md), which the agents
read.

## Setup

Node 22 (`.nvmrc`), then `npm install`. `prepare` installs the lefthook git hooks and builds the
ESLint plugin, because the repository lints itself with it (`eslint.config.js` loads it from
`dist/`).

## Gates

`npm run check` before every commit, and green CI on every PR. It runs, in order: Biome and
ESLint (`lint`), the text guard (`check:text`: no em or en dash anywhere, Markdown included; no
consuming app name or GitHub project id in `plugin/` or `packages/`), the schema copy
(`check:schema`), the plugin docs copies (`check:plugin`), dependency-cruiser on `packages/`
(`check:deps`), `tsc --noEmit` per package (`typecheck`), jest per package and the plugin tests
(`test`). Later work adds gates and never weakens one.

## Conventions

- Commits are `type(<issue>): message`, types `feat fix chore docs refactor test ci perf build`,
  enforced by commitlint on commit and in CI. No `Co-Authored-By` trailer. Never `--no-verify`,
  never force-push, never commit to `main` directly.
- No inline comments except `// NOTE:` and `// HACK:` codetags and TSDoc. No TypeScript `enum`,
  no `as Error`.
- Nothing in `plugin/` or `packages/` names an app; values come from `kit.config.json`, and test
  fixtures use neutral names such as `acme`.
- Tests are jest, in `src/**/__tests__/*.test.ts` per package and `tests/plugin/*.test.mjs` for
  the plugin.

## Lockstep versions

Every package, the plugin manifest (`plugin/.claude-plugin/plugin.json`) and the marketplace
entry (`.claude-plugin/marketplace.json`) carry the same version, and every `@timothyrusso/*`
dependency between the packages is pinned to it. An app therefore installs one version of the
kit, and a plugin version always matches the rules its agents describe. Nothing bumps a single
package: the release script bumps them all.

## Releasing

1. On `main`, with a clean tree and green CI, pick the version and the issue that tracks the
   release.
2. `npm run release -- <version> --issue <n> --dry-run` lists every manifest it would bump.
3. `npm run release -- <version> --issue <n>` bumps every manifest and the lockfile, commits
   `chore(<n>): release <version>` and creates the annotated tag `v<version>`.
4. `git push --follow-tags`. Pushing the tag runs `.github/workflows/release.yml`, which checks
   that `NPM_TOKEN` is set, verifies that every manifest matches the tag
   (`node scripts/release.js --verify <version>`), runs `npm run check` and `npm run build`, and
   publishes every package with `npm publish --workspaces --access public`.

`NPM_TOKEN` is a repository secret holding an npm automation token with publish rights on the
`@timothyrusso` scope. If it is missing the workflow fails at its first step with the fix; add the
secret and re-run the workflow. The plugin needs no publishing: apps install it from this
repository's marketplace.

## Adding an ESLint rule

In `packages/eslint-plugin-arch`:

1. Write the rule in `src/rules/<camelName>.ts` with `createRule` (its docs URL points at the
   rule's README section). Read options with defaults; read `kit.config.json` values only
   through the recommended config, never from disk inside the rule.
2. Register it by id in `src/rules/index.ts`.
3. Turn it on in `src/configs/recommended.ts`: always, or behind a `lint` option. A new option is
   added to `schema/kit.config.schema.json` first, then `npm run sync:schema`, then the
   `LintKitConfig` type.
4. Test it with `@typescript-eslint/rule-tester` in `src/__tests__/rules/<camelName>.test.ts`:
   named valid and invalid cases, the message id and position of each report, and every option.
5. If it applies to app code, add a deliberate violation to a `broken` file of the fixture app in
   `src/__tests__/fixtures/app` and the expected rule id to `recommended.test.ts`; clean fixture
   files must stay clean.
6. Document it: a section in the package README, a row in the README table, and the rule id in
   the rules table of [ARCHITECTURE.md](ARCHITECTURE.md) (or in
   [ERROR_HANDLING.md](ERROR_HANDLING.md) when it is about failures). `src/__tests__/docs.test.ts`
   fails until the id appears in one of the two, so a rule cannot ship undocumented.

## Adding a dependency-cruiser rule

In `packages/arch-rules`:

1. Add the rule to the generator it belongs to: `layerRules.ts` (layers and folders),
   `effectRules.ts` (Effect placement), or a per-feature generator like `tierRules.ts` (one rule
   per feature, named `<rule>-<feature slug>`). Paths come from `featuresRoot` and `appRoot`;
   escape them with `escapeRegex`.
2. Test it in `src/__tests__/rules.test.ts` with `describeRule(id, violating, passing)`: each case
   is a small file tree that dependency-cruiser really resolves, so write at least one violation
   and one near miss that must pass (a type-only import, an allowed exception).
3. `referenceTree.test.ts` checks the rules against a real app's tree and its original rules; a
   rule that exists only in the kit is added to its list of kit-only rules.
4. Document it: the README table, and the rule id in [ARCHITECTURE.md](ARCHITECTURE.md). For a
   per-feature family, document the pattern (`<rule>-<feature>`) and give `docs.test.ts` a
   feature that produces it. The package's `docs.test.ts` fails on any undocumented id.

## Docs and their copies

The root docs (`ARCHITECTURE.md`, `ERROR_HANDLING.md`, `AGENTIC_WORKFLOW.md`, `EFFECT_PRIMER.md`,
`MIGRATION_GUIDE.md`) are the sources. The plugin ships copies in `plugin/docs/`, which its agents
read at run start, and `config-presets` ships a copy of the Feature issue template. After editing
a source run `npm run sync:plugin-docs`; `npm run check:plugin` fails while a copy differs, is
missing or has no source. Never edit the copies. `CONTRIBUTING.md` is about the kit itself and is
not shipped.

The docs describe what the packages do. When a change alters behaviour a doc describes (a rule, an
export, a default), update the doc in the same PR. `EFFECT_PRIMER.md` stays under 400 lines, in
short sections that each end with a "Where you see it" line.

`schema/kit.config.schema.json` is the source of the schema copy in
`packages/config-presets/src/`; run `npm run sync:schema` after editing it.
