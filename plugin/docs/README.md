# Kit docs

Copies of the agentic-kit docs, shipped inside the plugin so it is self-contained: the agents
read them at run start as `${CLAUDE_PLUGIN_ROOT}/docs/<name>.md`, then the app's own
`docs/ARCHITECTURE.md` deltas and `CLAUDE.md`.

| Doc | What it holds |
| --- | --- |
| `ARCHITECTURE.md` | Feature modules, integer tiers, layers, Services, Layers and the runtime, the ViewModel contract, the rules table |
| `ERROR_HANDLING.md` | `Effect<A, E, R>`, tagged errors and the closed `AppError` union, logging at the runtime boundary |
| `AGENTIC_WORKFLOW.md` | `kit.config.json`, the plugin install steps, the pipeline and the overnight runbook |
| `EFFECT_PRIMER.md` | A short study document on Effect as the kit uses it |
| `MIGRATION_GUIDE.md` | How an existing Expo app adopts the kit |

Do not edit the copies: the sources are at the root of the agentic-kit repository, and
`npm run sync:plugin-docs` refreshes this folder (`npm run check` fails when it has drifted).
