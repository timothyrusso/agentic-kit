---
name: write-issue
description: Author a complete, well-specified GitHub feature issue by interviewing the user until the Description and Acceptance criteria are unambiguous, then create it with the Feature template structure and put it on the board named in kit.config.json. Use when starting a new feature from a rough idea; it front-loads clarification so /implement-issue and the implement-issue-pipeline workflow can trust the issue. `--dry-run` prints the issue and the board it would use without creating anything.
argument-hint: "[--dry-run] [--yes] [rough idea or title]"
---

# write-issue: author a complete, ready-to-implement feature issue

Turn a rough idea into a GitHub issue so clear and complete that an agent can implement it with
no further questions. This front-loads the clarification that would otherwise happen at
implementation time, so the downstream pipeline can trust the issue.

**Parse `$ARGUMENTS`:**
- `--dry-run`: do everything except create. Nothing is written to GitHub: no `gh issue create`,
  no `gh project` call. The skill ends by printing the issue and the board and labels it would use.
- `--yes`: the rest of the arguments are the complete, already agreed brief (a caller agent or a
  headless session). Skip the interview and the approval gate in steps 1 and 3: `--yes` is the
  explicit go-ahead. Still refuse to invent scope: anything the brief leaves open goes in the
  Description as an explicit assumption.
- The remaining text is the rough idea. If it is empty (and there is no `--yes`), ask the user
  what they want to build.

## Run start

Read `kit.config.json` at the repository root: `projectName` (the app), and the `github` section
(`projectNumber`, `projectId`, `statusFieldId`, `statusOptions.todo`, `labels`). You never type a
board id yourself: the script in step 4 reads them from the file. If there is no `github`
section, the issue is created on no board; say so in the report.

## Process

1. **Interview the user with the `grilling` skill** (skipped with `--yes`). Stress-test the idea
   until you can answer, without guessing: what exactly is being built, the expected behaviour,
   the edge and negative cases, which screens or features it touches, what is explicitly out of
   scope, and how each outcome is verified at runtime. Keep going until every acceptance
   criterion is concrete and testable: not "works well" but "tapping X navigates to Y". When a
   question can be answered by reading the codebase, read it instead of asking.

2. **Draft the issue** with the **exact** Feature template headings, so `/implement-issue` and the
   workflow parse it identically. Write the body to a temporary file:

   ```markdown
   ### Description
   <what the feature does, expected behaviour, constraints: specific and self-contained>

   ### Acceptance criteria
   - [ ] <observable, verifiable outcome, testable at runtime>
   - [ ] ...

   ### Screens affected
   <e.g. Home, Settings, or omit if none>

   ### Out of scope
   - <anything explicitly excluded, or omit>

   ### Design link
   <URL, or omit>
   ```

   The title is a concise summary; the script adds the template's `[Feature]: ` prefix.

3. **Review with the user** (skipped with `--yes`). Show the draft; iterate until they approve.
   Do not pad criteria or invent scope. Never create the issue without the explicit go-ahead: it
   is an outward action.

4. **Create it, or show what would be created.** One script does both, with every id from
   `kit.config.json`:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/write-issue.mjs" --title "<title>" --body-file <file> [--dry-run]
   ```

   - With `--dry-run` it prints the title, the labels, the board (project number, owner, project
     id, status field and the `todo` option) and the exact `gh` commands, then the body. Relay
     that output verbatim and stop: nothing was created.
   - Without it, it runs `gh issue create` (title prefix `[Feature]: `, the `enhancement` label
     when `github.labels` lists it), then `gh project item-add` on the board and
     `gh project item-edit` to set its Status to the `todo` option, so the issue lands in a board
     column. It prints one JSON line: `issueUrl`, `addedToBoard`, `statusSet`, `problems`.
   - The board calls need the `project` scope on the gh token. When one fails, the issue still
     stands: do NOT delete or recreate it. Report the failure and the remediation
     (`gh auth refresh -s project`) so the user can finish it by hand.
   - The script refuses a body without the `### Description` and `### Acceptance criteria`
     headings; fix the draft rather than working around it.

5. **Report** the issue number and URL, whether it was added to the board and **whether its
   status was set** (say so explicitly either way, with the reason on failure), and the next step:
   `/implement-issue <n>` (the front door: it judges the issue and delegates to the
   `agentic-kit:implement-issue-pipeline` workflow), or the workflow directly for headless runs.

## Rules

- Acceptance criteria must be **testable**: each one becomes a QA test case.
- The Description is self-contained: the implementer builds from it alone.
- Never create the issue without the user's explicit go-ahead (or `--yes`).
- An issue that is not on the board, or is on it with no Status, is invisible to the user:
  always report the `addedToBoard` and `statusSet` outcome.
