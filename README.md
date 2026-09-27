# agentic-kit

Shared architecture for agent-driven Expo apps. One repository, two outputs:

- **A Claude Code plugin** (`plugin/`): agents, skills and the implement-issue workflow, published
  through this repository's marketplace.
- **Four npm packages** (`packages/`, scope `@timothyrusso`, versions in lockstep):

| Package | What it gives an app |
| --- | --- |
| `@timothyrusso/eslint-plugin-arch` | ESLint rules: ViewModel contract, comments, dashes, layout tokens, stable row handlers, no Effect in views |
| `@timothyrusso/arch-rules` | dependency-cruiser rules generated from each feature's `FEATURE_TIER` |
| `@timothyrusso/config-presets` | Biome, commitlint, lefthook, tsconfig, Jest and CI presets, and the `kit.config.json` loader |
| `@timothyrusso/effect-core` | `AppError`, Logger, Config, the app runtime, `SqliteClient`, React hooks and testing helpers |

`template/` holds an Expo SDK 57 app already wired to the kit (expo-router, TanStack Query,
zustand, Effect, expo-sqlite), with a sample feature showing every layer and a fixture that
violates every kit rule. It is published as the GitHub template repository
[`timothyrusso/expo-kit-template`](https://github.com/timothyrusso/expo-kit-template), which needs
kit 0.1.0 or later.

## Using the kit in an app

1. At the app root, run `npx @timothyrusso/config-presets init` (or `init --yes` for the
   defaults). It writes `kit.config.json` and the Biome, commitlint, lefthook, tsconfig, Jest,
   ESLint, dependency-cruiser, CI and Claude Code settings files, adds the `check` script, and
   installs the tools and git hooks. See the
   [config-presets README](packages/config-presets/README.md).
2. `npm run check`.
3. Enable the plugin in Claude Code: `/plugin marketplace add timothyrusso/agentic-kit`, then
   `/plugin install agentic-kit` (the `.claude/settings.json` that `init` writes already names the
   marketplace).
4. `npm install @timothyrusso/effect-core effect` for the runtime.

`kit.config.json` needs only `projectName`; the schema is
[`schema/kit.config.schema.json`](schema/kit.config.schema.json) and ships in the package as
`@timothyrusso/config-presets/kit.config.schema.json`:

```json
{
  "$schema": "./node_modules/@timothyrusso/config-presets/dist/kitConfig.schema.json",
  "projectName": "acme",
  "featuresRoot": "features",
  "qa": { "targets": ["mobile"], "simulator": "iPhone 17 Pro", "metroPort": 8082 }
}
```

The tools support TypeScript 5.9 and 6.x: dependency-cruiser 18 does not support TypeScript 7.

Every package and the plugin read the same file through `loadKitConfig()`, which reports every
problem at once, for example `missing required field "projectName"`.

## Developing the kit

Node 22 (`.nvmrc`). `npm install`, then:

- `npm run check`: Biome, ESLint, the text guard, schema and plugin sync, `tsc --noEmit`, Jest per
  package and the plugin tests (`tests/plugin/`: the workflow run with stubbed agents, the
  write-issue script, the manifests).
- `npm run sync:plugin-docs`: copies the root docs into `plugin/docs/` and the Feature issue
  template into `config-presets`; `check` fails when a copy drifts. See the
  [plugin README](plugin/README.md).
- `npm run build`: `tsc` for every package into `dist/`.
- `npm run smoke:presets`: packs the packages, creates a fresh Expo app, runs `config-presets init
  --yes` and the app's own `pr-checks.yml` checks on it (also the `presets-smoke.yml` workflow).
- `npm run template:verify`: packs the packages, installs `template/` against them in a temp folder
  and runs its `npm run check`, `npm test`, `npm run arch`, `npm run arch:fixtures` and
  `npx expo export --platform ios` (the `template` job of `ci.yml`, on every PR).
- `npm run template:sync -- --issue <n>`: pushes `template/` to `timothyrusso/expo-kit-template`,
  creating that template repository if it is missing (`--dry-run` to preview).
- `npm run release -- <version> --issue <n>`: bumps every package and the plugin manifest, commits
  `chore(<n>): release <version>` and tags `v<version>`. Pushing the tag runs `release.yml`,
  which publishes every package (needs the `NPM_TOKEN` repository secret).

Conventions are in [CLAUDE.md](CLAUDE.md); releasing, lockstep versions and adding a rule are in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Docs

| Doc | What it holds |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Feature modules, integer tiers, layers, Services, Layers and the runtime, the ViewModel contract, every rule id |
| [ERROR_HANDLING.md](ERROR_HANDLING.md) | `Effect<A, E, R>`, tagged errors and the closed `AppError` union, logging at the runtime boundary, boot and migration failures |
| [AGENTIC_WORKFLOW.md](AGENTIC_WORKFLOW.md) | `kit.config.json`, installing the plugin, the pipeline, bot triage and the overnight runbook |
| [EFFECT_PRIMER.md](EFFECT_PRIMER.md) | A short study document on Effect as the kit uses it |
| [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) | How an existing Expo app adopts the kit |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Working on the kit: gates, releases, adding a rule, docs sync |

All but CONTRIBUTING.md ship inside the plugin as `plugin/docs/` (`npm run sync:plugin-docs`).

## License

MIT
