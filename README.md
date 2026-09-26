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

`template/` will hold an Expo app already wired to the kit.

## Using the kit in an app

1. Install the packages:
   `npm install -D @timothyrusso/config-presets @timothyrusso/eslint-plugin-arch @timothyrusso/arch-rules`
   and `npm install @timothyrusso/effect-core effect`.
2. Enable the plugin in Claude Code: `/plugin marketplace add timothyrusso/agentic-kit`, then
   `/plugin install agentic-kit`.
3. Add a `kit.config.json` at the app root. Only `projectName` is required; the schema is
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

4. Copy or extend the presets from `@timothyrusso/config-presets` (Biome, lefthook, commitlint,
   tsconfig, Jest, CI) and add `npm run check` to the app.

Every package and the plugin read the same file through `loadKitConfig()`, which reports every
problem at once, for example `missing required field "projectName"`.

## Developing the kit

Node 22 (`.nvmrc`). `npm install`, then:

- `npm run check`: Biome, ESLint, the text guard, schema sync, `tsc --noEmit` and Jest per package.
- `npm run build`: `tsc` for every package into `dist/`.
- `npm run release -- <version> --issue <n>`: bumps every package and the plugin manifest, commits
  `chore(<n>): release <version>` and tags `v<version>`. Pushing the tag runs `release.yml`,
  which publishes every package (needs the `NPM_TOKEN` repository secret).

Conventions are in [CLAUDE.md](CLAUDE.md). The architecture, error handling, agentic workflow and
Effect primer docs live at the repository root.

## License

MIT
