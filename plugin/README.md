# agentic-kit Claude Code plugin

Agents, skills and the implement-issue workflow for React Native (Expo) apps built on the
agentic-kit architecture. Nothing here names an app: every app-specific value (project name,
feature root, board ids, labels, simulator, Metro port, QA targets, baseline steps) comes from the
app's `kit.config.json`, which every agent and skill reads at run start.

## Install

```text
/plugin marketplace add timothyrusso/agentic-kit
/plugin install agentic-kit@agentic-kit
```

`npx @timothyrusso/config-presets init` already writes both into the app's `.claude/settings.json`.
To try a local checkout: `claude --plugin-dir <path to agentic-kit>/plugin`.

## What it ships

| Kind | Names |
| --- | --- |
| Agents (`agents/`) | `explorer`, `feature-builder`, `code-reviewer`, `finding-vetter`, `qa-engineer`, `qa-web-engineer` |
| Skills (`skills/`) | `write-issue`, `implement-issue`, `triage-pr`, `qa-baseline`, `dogfood`, `handoff`, `grilling`, `grill-me`, `grill-deck`, `teach`, `writing-great-skills`, `docs-audit`, `agent-device`, `agent-device-configuration` |
| Workflow (`workflows/`) | `implement-issue-pipeline`, addressed as `agentic-kit:implement-issue-pipeline` |
| Scripts (`scripts/`) | `write-issue.mjs` (creates the issue and puts it on the board), `run-metrics.mjs` (the run metrics comment), `kit-config.mjs` |
| Docs (`docs/`) | copies of the kit docs, synced from the repository root by `npm run sync:plugin-docs` |
| Templates (`templates/ISSUE_TEMPLATE/`) | the Feature issue form, which `config-presets init` copies into the app's `.github/ISSUE_TEMPLATE/` |
| Agent memory (`agent-memory/`) | the convention only; each app commits its own `.claude/agent-memory/` |

Plugin agents are addressed as `agentic-kit:<name>` (the workflow does so). Skills are invoked as
`/write-issue` or `/agentic-kit:write-issue`.

## The flow

1. `/write-issue <idea>` interviews you, drafts a Feature issue and, on your go-ahead, creates it
   with `[Feature]: ` in the title, the `enhancement` label when `github.labels` lists it, and adds
   it to the board with its Status set to `github.statusOptions.todo`. `/write-issue --dry-run`
   prints the issue and the board and labels it would use, and creates nothing. `--yes` takes the
   arguments as the agreed brief (for agents and headless sessions).
2. `/implement-issue <n>` judges the issue, grills only when needed, then runs the workflow:
   explore, build (a PR from `feature/<n>`), wire the PR (assignee, board, status in progress),
   code review in parallel with device and web QA, one vetter per blocking finding, a bounded fix
   loop, one consolidated run comment, and a visual summary of the QA screenshots. Then it posts
   the run metrics and runs `/triage-pr` on the bot reviews.
3. Headless: call the workflow directly with `{ issue, kitConfig, ... }`; see its `meta.whenToUse`.

## `kit.config.json` fields the plugin reads

| Field | Used by |
| --- | --- |
| `projectName` | every prompt, and the run comment and visual summary markers (`<!-- <slug>:pipeline-run -->`, `<!-- <slug>:visual-summary -->`) |
| `featuresRoot`, `appRoot` | explorer, feature-builder, code-reviewer, finding-vetter |
| `github.projectNumber`, `projectId`, `statusFieldId`, `statusOptions`, `labels` | write-issue (Status `todo`), the workflow's PR wiring (Status `inProgress`) |
| `qa.targets` | the QA surfaces the explorer may choose, and the fallback when it cannot decide |
| `qa.simulator`, `qa.metroPort` | qa-engineer (device choice, Metro port), qa-web-engineer (port) |
| `qa.baseline` | qa-baseline: `setup`, `launch`, `firstScreens`, `navigation` |
| `lint.allowedHooksInViews` | feature-builder and code-reviewer (the ViewModel contract) |

The board owner is the owner of the repository (`origin`), since the schema holds the project
number and ids but no owner.

## Third-party skills

`grilling`, `grill-me`, `handoff`, `teach` and `writing-great-skills` come from
[mattpocock/skills](https://github.com/mattpocock/skills); `agent-device` and `dogfood` from
[callstack/agent-device](https://github.com/callstack/agent-device). Both are MIT licensed. They are vendored with
dashes replaced to satisfy the kit's text rule; `grill-me` is an alias of `grilling`.
