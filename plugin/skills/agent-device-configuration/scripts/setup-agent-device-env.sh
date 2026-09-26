#!/usr/bin/env bash
set -euo pipefail

# Appends the agent-device iOS runner variables to the user's shell profile.
# Usage: setup-agent-device-env.sh <APPLE_TEAM_ID> <RUNNER_BUNDLE_ID>
# Idempotent: when the marker block is already present, the script does nothing.

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <APPLE_TEAM_ID> <RUNNER_BUNDLE_ID>" >&2
  exit 2
fi

TEAM_ID="$1"
BUNDLE_ID="$2"

if ! [[ "${TEAM_ID}" =~ ^[A-Z0-9]{10}$ ]]; then
  echo "The Apple Team ID must be 10 upper-case letters or digits, got: ${TEAM_ID}" >&2
  exit 2
fi
if ! [[ "${BUNDLE_ID}" =~ ^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$ ]]; then
  echo "The bundle id must be reverse-DNS, e.g. com.example.agentdevice.runner, got: ${BUNDLE_ID}" >&2
  exit 2
fi

MARKER="# Agent-device"

shell_name="$(basename "${SHELL:-}")"
case "${shell_name}" in
  zsh) PROFILE="${HOME}/.zshrc" ;;
  bash)
    if [ -f "${HOME}/.bash_profile" ]; then
      PROFILE="${HOME}/.bash_profile"
    else
      PROFILE="${HOME}/.bashrc"
    fi
    ;;
  *) PROFILE="${HOME}/.zshrc" ;;
esac

if [ -f "${PROFILE}" ] && grep -qF "${MARKER}" "${PROFILE}"; then
  echo "agent-device env vars already present in ${PROFILE}; nothing to do."
  exit 0
fi

{
  echo ""
  echo "${MARKER}"
  echo "export AGENT_DEVICE_IOS_TEAM_ID=${TEAM_ID}"
  echo "export AGENT_DEVICE_IOS_BUNDLE_ID=${BUNDLE_ID}"
} >>"${PROFILE}"

echo "Added agent-device env vars to ${PROFILE}."
echo "Run 'source ${PROFILE}' or open a new terminal to load them."
