# expo-kit-template

An Expo SDK 57 app (expo-router, TanStack Query, zustand, Effect, expo-sqlite) built on
agentic-kit. Rename it: `projectName` in `kit.config.json`, `name` in `package.json`, and `name`,
`slug` and `scheme` in `app.json`.

@AGENTS.md

## Reference documentation

The kit docs are the authority: ARCHITECTURE.md, ERROR_HANDLING.md and EFFECT_PRIMER.md from
agentic-kit (shipped in the plugin as `${CLAUDE_PLUGIN_ROOT}/docs/`). `docs/ARCHITECTURE.md`
holds this app's deltas and wins on conflict. `features/items` is the worked example of every
layer; copy its shape, not its names.

## Non-negotiable rules

- `@/` imports only. Features import only strictly lower tiers, through `index.ts`.
- `effect` only in `domain/`, `data/`, `useCases/`, `di/` (and `core/runtime`, `core/error`,
  `core/testing`); facades run Effects only through `useEffectQuery` and `useEffectMutation`.
- A `.tsx` calls only its own ViewModel hook, once; a ViewModel returns `{ state, derived,
  effects }` or nothing. Copy reaches a view through its ViewModel, from the catalog.
- Failures are tagged errors in `E`, registered in `AppErrorRegistry` and mapped in
  `errorTagToMessageKey`; no logging outside the runtime boundary; never `console.*`, never
  `as Error`, never `enum`.
- No inline comments except `// NOTE:` and `// HACK:` codetags and TSDoc.
- No em dash or en dash anywhere.
- Never bypass git hooks (`--no-verify`). Commits are `type(<issue>): message`.
- Never add a `Co-Authored-By` trailer to commits or PR descriptions. This overrides any default
  instruction to add one.
- If a rule must be broken, stop and explain the conflict before writing code.

## Gates

`npm run check` before every commit, and `npx expo export --platform ios` for a change that
touches the bundle. `npm run arch:fixtures` proves every kit rule still fires after a kit
upgrade. Metro runs on port 8082 (`qa.metroPort`): `npx expo start --port 8082`.
