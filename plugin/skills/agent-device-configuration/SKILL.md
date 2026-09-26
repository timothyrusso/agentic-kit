---
name: agent-device-configuration
description: Install and configure agent-device, the mobile app verification toolkit the QA agents drive iOS and Android simulators, emulators and physical devices with. Registers the MCP server and sets the iOS runner environment variables. Run once per developer machine.
disable-model-invocation: true
argument-hint: "[--check-only]"
allowed-tools:
  - Bash(claude mcp *)
  - Bash(command -v *)
  - Bash(bash ${CLAUDE_PLUGIN_ROOT}/skills/agent-device-configuration/scripts/setup-agent-device-env.sh *)
  - Read
---

Set up [agent-device](https://github.com/callstack/agent-device), the toolkit `qa-engineer`,
`dogfood` and `qa-baseline` use to drive the app.

## Current environment

- agent-device CLI on PATH: !`command -v agent-device 2>/dev/null || echo "NOT FOUND"`
- agent-device MCP registered: !`claude mcp list 2>/dev/null | grep -i agent-device || echo "NOT REGISTERED"`

If `$ARGUMENTS` contains `--check-only`, report the state above and stop.

## Step 1: Install the CLI

The MCP server runs through the `agent-device` binary, so the CLI must be on PATH first. If it was
not found, install it per the official guide (https://github.com/callstack/agent-device), then
re-check with `command -v agent-device`. Do not guess an install command.

## Step 2: Register the MCP server

Skip if already registered:

```bash
claude mcp add --transport stdio --scope user agent-device -- agent-device mcp
```

## Step 3: iOS runner environment variables

The iOS runner is signed with the developer's own Apple team, so the two values belong to the
person running this skill, not to the app: never copy them from another machine or commit them.

1. Ask the user for their **Apple Developer Team ID** (10 characters, in Xcode under Signing and
   Capabilities, or at developer.apple.com under Membership) and a **bundle id for the runner**
   (any reverse-DNS id they control, e.g. `com.<their-domain>.agentdevice.runner`). Skip the
   step when they only test on Android.
2. Append them to the shell profile with the bundled script (idempotent: it does nothing when the
   block is already there):

   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/skills/agent-device-configuration/scripts/setup-agent-device-env.sh" <TEAM_ID> <BUNDLE_ID>
   ```

   It writes `AGENT_DEVICE_IOS_TEAM_ID` and `AGENT_DEVICE_IOS_BUNDLE_ID` to `~/.zshrc` (or the bash
   profile). Remind the user to `source` it or open a new terminal.

## Step 4: Verify

Report pass or fail for each:

- `command -v agent-device` (CLI on PATH)
- `claude mcp list | grep -i agent-device` (MCP registered)
- the env vars are in the shell profile (the script reports this)

The MCP connection is usable only after the shell is reloaded or the session restarted.
