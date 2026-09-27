---
name: docs-audit
description: Read-only audit of an app's documentation and Claude Code configuration for staleness against the current codebase and the agentic-kit plugin. Produces a report of what is outdated (stale or suspect) with the file and the fix. Use to check whether the app's docs, CLAUDE.md, kit.config.json and .claude/ config still match reality.
---

# docs-audit: is the documentation still true?

**Read-only.** You produce a **report**; you never modify a file.

Documentation and config drift as code changes: a renamed file, a removed npm script, a rule now
enforced differently, a board id that no longer exists. Check whether the app's operational
config and docs still match the codebase and the kit, and report what is stale. Catch both
**structural** drift (broken references) and **semantic** drift (prose describing behaviour the
code no longer has).

## Run start

Read `kit.config.json` at the repository root: `projectName`, `featuresRoot`, `appRoot`, `github`,
`qa`, `lint`, `i18n`. The kit's own docs are in `${CLAUDE_PLUGIN_ROOT}/docs/`; they are the
reference the app's docs add deltas to, not something this audit edits.

## What to audit

- `kit.config.json`
- `CLAUDE.md` and `docs/*.md` (in particular `docs/ARCHITECTURE.md`, the app's deltas from the kit)
- `.claude/settings.json`, `.claude/agent-memory/*.md`, `.claude/triage-bots.json`, and any
  app-local `.claude/agents`, `.claude/skills` or `.claude/workflows` that override the plugin's
- `.github/ISSUE_TEMPLATE/feature.yml`, `.github/workflows/*.yml`
- `README.md`

## Checks

**Structural**: confirm each referenced thing still exists.
- Repo paths in the config and docs (`<featuresRoot>/core/runtime`, `docs/ARCHITECTURE.md`, ...)
  exist. `featuresRoot` and `appRoot` in `kit.config.json` point at real folders.
- `npm run <script>` references exist in `package.json` (`check`, `check:arch`, `lint`, ...).
- Agent and skill names the app's docs mention exist in the plugin (`explorer`,
  `feature-builder`, `code-reviewer`, `finding-vetter`, `qa-engineer`, `qa-web-engineer`) or in
  the app's own `.claude/`.
- The board in `kit.config.json` is reachable: `gh project view <github.projectNumber> --owner
  <repository owner> --format json` succeeds, and `github.statusOptions` ids appear in
  `gh project field-list`.
- Tools the config assumes (agent-device, agent-browser, gh, depcruise) are still wired in.

**Semantic**: does the prose still match the code and config?
- Rules `CLAUDE.md` or `docs/ARCHITECTURE.md` claim are enforced are backed by a real rule in
  `eslint.config.*` (the `arch/*` rules), `.dependency-cruiser.*` (the `@timothyrusso/arch-rules`
  rules), `biome.json` or `lefthook.yml`.
- The app's deltas in `docs/ARCHITECTURE.md` still differ from the kit docs; a delta that the kit
  now covers is redundant (suspect).
- Every feature folder has a `FEATURE_TIER` in its `index.ts`, and the tiers the docs describe
  match them.
- The issue template headings match what the agents parse (`### Description`,
  `### Acceptance criteria`).
- `qa.baseline` in `kit.config.json` names screens and steps that still exist.
- `lint.allowedHooksInViews` names hooks that still exist.

## Critical exclusion

The kit docs use **intentionally fake example paths** (`features/items/...`). Never flag an
illustrative example path as broken. Only check references the operational config depends on, and
the docs' factual claims about how the app works.

## Discipline

- Read-only: never edit. Ground every finding in a real file and line or command output; verify a
  path with Read or Glob before calling it broken.
- Distinguish **definitely wrong** from **worth checking**; do not cry wolf.

## Output: a report

```markdown
## Docs and config audit: <projectName>

### Stale: definitely wrong
- `path:line`: <what is wrong> → <fix>

### Suspect: worth a human check
- `path`: <the concern>

### Checked and current
- <one-line summary of what was verified and found consistent>

### Summary
- <counts, and the one or two things most worth fixing first>
```

End with a one-line caveat: this is a point-in-time reasoning audit, not a guarantee; it flags
likely staleness for human review.
