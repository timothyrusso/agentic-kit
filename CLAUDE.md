# agentic-kit

Shared architecture for agent-driven Expo apps: a Claude Code plugin in `plugin/` and npm
workspaces in `packages/` (`@timothyrusso/*`, versions in lockstep). Node 22, TypeScript strict,
ESM, Biome for format and lint, ESLint only for `no-restricted-syntax` and the kit's own plugin.

## Commits

- `type(<issue>): message`, e.g. `feat(4): add tier rule generator`. Types: feat fix chore docs
  refactor test ci perf build. commitlint enforces it on commit and in CI.
- No `Co-Authored-By` trailer and no "Generated with" line.
- Never `--no-verify`, never force-push, never commit to `main` directly.

## Text

No em dash (U+2014) or en dash (U+2013) anywhere: code, comments, docs, commit messages. Use a
colon, comma, parentheses or a hyphen. `npm run check:text` enforces it.

Nothing in `plugin/` or `packages/` names a consuming app (HolidAI, Kinetiq) or holds a GitHub
project id (`PVT_...`, `PVTSSF_...`, `PVTF_...`): those values come from `kit.config.json`. Test
fixtures use neutral names like `acme`. The root `kit.config.json` is the kit's own board config.

## Code

- No inline comments except `// NOTE:` and `// HACK:` codetags, plus TSDoc `/** */` blocks.
- No TypeScript `enum`, no `as Error`.
- `schema/kit.config.schema.json` is the source of truth; after editing it run
  `npm run sync:schema` to refresh the copy in `packages/config-presets/src/`.
- The root docs and `plugin/templates/ISSUE_TEMPLATE/` are the sources of the copies in
  `plugin/docs/` and `packages/config-presets/github/ISSUE_TEMPLATE/`; after editing them run
  `npm run sync:plugin-docs`.
- Tests are Jest, in `src/**/__tests__/*.test.ts` per package.

## Gates

`npm run check` before every commit and green CI on every PR. Later work adds gates, never
weakens them. Port 8081 is taken on this machine: never start Metro on it.
