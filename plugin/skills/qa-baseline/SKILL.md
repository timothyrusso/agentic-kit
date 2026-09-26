---
name: qa-baseline
description: The standing baseline QA checks to run for EVERY feature, whatever it does, as a regression safety net, with the app-specific steps (setup, launch, first screens, navigation) read from kit.config.json. Run them on the device with agent-device before any feature-specific acceptance-criteria tests. Use when doing QA on a feature branch.
---

# Baseline QA checks

The minimum checks that must pass for **every** feature, independent of the feature itself. They
guard against regressions and broken app health. Run them first, then the feature's own
acceptance criteria.

## Environment

- Drive the app with **agent-device** only; no other device-control tooling.
- The feature branch is checked out and the app is installed or buildable on the pinned device.

## App-specific steps come from `kit.config.json`

Read `qa.baseline` from `kit.config.json` at the repository root. Every field is optional:

| Field | Used in | When it is missing |
| --- | --- | --- |
| `setup` | before the checks: for example how to sign in with the test account, or which test data to load | no setup |
| `launch` | check 1: what a healthy cold launch reaches | the app's first screen, whatever it is |
| `firstScreens` | check 2: screens that must render right after launch | only the screens the diff touches |
| `navigation` | check 3: primary navigation steps to exercise, one per entry | skip check 3 |

Secrets never live in `kit.config.json`: when `setup` names a credential, it names the
environment variable or `.env` key that holds it (read it with
`grep '^NAME=' .env | cut -d= -f2`), never the value.

**Restore state:** a test that signs the user out, or otherwise undoes `setup`, must redo `setup`
before finishing, so the next QA run does not start stranded.

## Checks

### 1. App startup (critical)
Cold-launch the app on the device.
- **Pass:** it reaches the `launch` state without crashing, no red screen or fatal error, and no
  fatal errors in the logs during launch.
- **Fail:** crash on launch, red screen, stuck splash, or a fatal error.
- Evidence: a screenshot of the launched screen.

### 2. First screens render
Visit each screen in `firstScreens` (or the screens the diff touches).
- **Pass:** each renders its content: not blank, no error state, no red box.
- **Fail:** a blank or error screen, or a crash.

### 3. Primary navigation
Run each step in `navigation` in order (only when the field is set).
- **Pass:** each step lands where it says, and back navigation returns.
- **Fail:** a step does not navigate, lands on the wrong screen, or crashes.

## Reporting

Report the baseline as a section with, per check: the verdict (✅ pass / ❌ fail), a one-line note
and the screenshot path. If any baseline check fails, the feature fails QA whatever its
acceptance criteria say: state this clearly.
