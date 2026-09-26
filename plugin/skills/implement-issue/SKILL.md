---
name: implement-issue
description: Implement a GitHub feature issue end to end. Judges the issue (grills the user only if something genuinely needs clarifying, folding answers back into the issue body), announces its reading, launches the agentic-kit:implement-issue-pipeline workflow (explore, build, wire PR, review, runtime QA, bounded auto-fix, one consolidated run comment), posts the run metrics from the harness transcripts, then runs the triage-pr skill on the PR so the human gets a PR with no open bot threads, or a clear hand-back. Invoked with an issue number, e.g. `/implement-issue 378 [--skip-explore] [--skip-review] [--skip-qa] [--skip-triage] [--worktree] [--max-fix N]`.
argument-hint: <issue-number> [--skip-explore] [--skip-review] [--skip-qa] [--skip-triage] [--worktree] [--max-fix N]
disable-model-invocation: true
---

# implement-issue: judge, clarify if needed, then delegate to the pipeline

You (the main thread) own only the **conversation**: judging the issue, grilling when genuinely
needed, announcing your reading, relaying the result, and holding the human gates of bot triage.
The build pipeline lives in ONE place, the `agentic-kit:implement-issue-pipeline` workflow
(`${CLAUDE_PLUGIN_ROOT}/workflows/implement-issue-pipeline.js`), and you NEVER re-implement any of
its stages (explore, build, review, QA, fix) here or dispatch those agents yourself. The same
holds for bot triage: it lives in the `triage-pr` skill, which you invoke rather than reproduce.

**Parse `$ARGUMENTS`:**
- First token = the **issue number** (required). If missing, ask which issue to work on.
- Flags are **overrides only**: the defaults live in the workflow (explore, review and QA on;
  worktree off). Map each flag the user passed to a workflow arg, and pass NOTHING for the others:
  - `--skip-explore` → `explore: false`
  - `--skip-review` → `review: false`
  - `--skip-qa` → `qa: false`
  - `--worktree` → `worktree: true` (isolation; expect a cold install and build in the worktree)
  - `--max-fix N` → `maxFix: N`
- `--skip-triage` is the one **skill-local** flag: triage runs outside the pipeline, so it is
  consumed here and passes nothing to the workflow. It skips Stage 5.

## Stage 0: Setup

- Read `kit.config.json` at the repository root; you pass its parsed content to the workflow as
  `kitConfig` (workflow scripts cannot read files). If it is missing, stop and tell the user to
  run `npx @timothyrusso/config-presets init`.
- `gh issue view <issue>`; confirm it is a Feature template issue (it has `### Description` and
  `### Acceptance criteria`). If not, tell the user and ask how to proceed.

## Stage 1: Judge (the only routing decision)

Read the Description and Acceptance criteria critically through **two independent lenses**. Both
are selective: raise something only when it has real teeth.

- **Lens 1, disambiguation ("is this clear enough to build?"):** genuine ambiguities, gaps,
  contradictions or risky assumptions that would change what gets built.
- **Lens 2, challenge ("is this a good idea?"):** a hidden risk the issue ignores, or a materially
  cheaper or better alternative with the same goal. Do not infer doubts from your own preferences
  and do not manufacture a critique to look diligent.

Route on the combined result:

- **Both lenses empty (clear AND sound):** say so and move on. Do not wait for approval: PR review
  is the approval gate for crisp issues.
- **Either lens has something with teeth:** run the `grilling` skill until every ambiguity is
  resolved and every challenge is addressed or consciously accepted. When a question can be
  answered by reading the codebase, read it instead of asking. A challenge the user overrules is
  settled: record the decision and proceed.

**Fold clarifications back into the issue body** (only if grilling happened): rewrite
`### Description` and `### Acceptance criteria` (and `### Out of scope` if scope changed) with the
exact template headings, show the user the rewritten body, and on their go-ahead apply it with
`gh issue edit <issue> --body-file <file>`. **Fallback**, if the user declines the edit: post the
clarifications as an issue comment and pass them to the workflow as `clarifications`.

## Stage 2: Announce, don't ask

- **If you grilled:** the synthesis at the end of the grilling ("so I'll build X, Y, Z") is the
  announcement; go to Stage 3.
- **If you did not:** state your reading in ONE short message (the criteria as you understand
  them, the feature you expect it to touch, the flags in effect) and IMMEDIATELY go to Stage 3.
  Silence is consent.

## Stage 3: Delegate to the pipeline

- Invoke the **Workflow tool** with `{ name: "agentic-kit:implement-issue-pipeline", args: {
  issue: <n>, kitConfig: <parsed kit.config.json>, ...overrides } }`. Pass `args` as a JSON
  object, not a string. Include `clarifications` only in the fallback case above. This skill
  explicitly authorizes that Workflow call.
- The workflow runs explore → build → wire PR → review ∥ QA → finding vetting → bounded auto-fix
  (history-aware, convergence-checked) → ONE consolidated run comment (posted even on an aborted
  run) → visual summary, and returns `{ prUrl, explored, reviewVerdict, qaVerdict, qaItems,
  qaWebVerdict, qaWebItems, fixAttempts, stuck, passed, outstanding, suspects, refuted }`.
- While it runs, do not poll or narrate; report when it completes.

## Stage 3b: Post the run metrics (best-effort, never blocking)

The pipeline keeps no metrics code: token spend, wall-clock and models are already on disk in the
session's run record and agent transcripts.

- Run this stage whenever the run produced a PR, including when the workflow ABORTED after
  opening one. On that path no `prUrl` came back, so recover it:
  `gh pr list --head feature/<issue> --json url --jq '.[0].url'`.
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/run-metrics.mjs" <pr-number> > <tmp-file> && gh pr comment <pr-url> --body-file <tmp-file>`.
  The script locates the run from the current directory, `CLAUDE_CODE_SESSION_ID` and the PR URL
  in the transcripts.
- If the script exits non-zero, post nothing, do not retry, and report its reason in Stage 4.
- Skip this stage only when no PR exists.

## Stage 4: Report

- Report **before** triage starts, so the outcome is visible immediately.
- Relay: the PR URL, review verdict, QA verdicts (with per-criterion `qaItems` and `qaWebItems`),
  fix attempts, and what needs attention:
  - `outstanding`: confirmed findings left after the fix loop. If `stuck` is true, say the loop
    stopped because a round made no progress.
  - `suspects`: device claims the vetter could not verify; never auto-fixed, always need human
    eyes, and they block a clean `passed`.
  - `refuted`: findings the vetter dismissed (so the human can spot-check them).
  - Non-blocking notes: BLOCKED or NEEDS-REVIEW items, QA `NOT_PERFORMED`, a failed metrics step.
- Do not merge the PR.

## Stage 5: Triage the bot reviews

The deliverable is a PR ready for a **human**, not one still carrying unanswered AI-reviewer
threads.

- **Announce, don't ask:** one line saying bot triage starts on the PR, then proceed.
- **Run the `triage-pr` skill** as `/triage-pr <pr> --issue <issue>`. This skill authorizes that
  invocation. Do NOT re-implement its steps or dispatch its agents yourself. It must run **in this
  conversation**, never as a subagent: its gates are settled with the user mid-round.
- **Automatic skips, exactly two, both announced:**
  - **No PR**: the pipeline aborted before the build.
  - **`--worktree`**: the feature branch stays attached to the isolation worktree, so
    `triage-pr`'s checkout fails. Give the user `/triage-pr <pr>` to run once it is removed.
- Triage still runs when the pipeline returned `outstanding`, `suspects`, `stuck: true` or QA
  `NOT_PERFORMED`: bot triage is orthogonal.
- **Workflow raised an error but a PR exists**: recover the URL as in Stage 3b and triage it; if
  no PR can be found, report the failure and stop.
- `--skip-triage` skips this stage; say so in one line.
- **One final message closes the run.** When triage ran, `triage-pr`'s closing message IS that
  message; add nothing after it. Emit it yourself only when triage never ran (a skip,
  `--skip-triage`, an unrecoverable abort), with the `/triage-pr <pr>` resume command whenever a
  PR exists. Never merge.

## Notes

- **Headless and batch runs** invoke `agentic-kit:implement-issue-pipeline` directly with the
  same args (including `kitConfig`; without it the workflow spends one cheap agent reading
  `kit.config.json`). They get no Stage 5, so run `/triage-pr <pr>` afterwards by hand.
- **One encoding rule:** pipeline behaviour (stages, defaults, prompts, caps) lives in
  `${CLAUDE_PLUGIN_ROOT}/workflows/implement-issue-pipeline.js`, never here; triage behaviour
  lives in the `triage-pr` skill.
- The QA stage drives the simulator and takes the longest.
