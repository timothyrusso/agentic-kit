# Agent memory

The plugin ships no memory of its own: this file is the convention. Each app keeps a committed
`.claude/agent-memory/` folder with one file per agent that learns on the job (today
`qa-engineer.md` and `qa-web-engineer.md`). The agent reads its file at the start of a run and may
append lessons under the rules below.

## Rules for appending

- **Only reusable operational knowledge**: tooling quirks, device or browser behaviour,
  environment facts, timings. Things that would otherwise be re-learned, and re-paid for, on
  every run.
- **Never** app-behaviour findings (those go in the QA report and the PR), anything the agent's
  own prompt already says, credentials or secrets, or speculation.
- **One line per lesson, dated**: `- [YYYY-MM-DD] <lesson>`.
- **Update or delete before adding**: check for an existing entry first; never duplicate.
- **Keep the file short**: about 40 lines. Prune stale entries when you add one.
- **Commit only that file**, on the feature branch, as its own commit:
  `chore(<issue>): qa lesson, <short slug>`.

## File layout

```markdown
# <agent> memory: operational lessons

Read at the start of every run. Append only under the rules in the plugin's
agent-memory/README.md. Humans curate at PR review.

## Known environment

- agent-device version last verified: <version> (<date>)

## Lessons

- [YYYY-MM-DD] <lesson>
```

## Curation

New or changed entries land in a feature PR and are reviewed like any other change: the human
keeps what is useful and deletes the rest. There is no automated curation.
