#!/usr/bin/env bash
# Install the pre-push guard into .git/hooks.
# Re-run any time to refresh the hook.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

HOOK_DIR=".git/hooks"
HOOK_FILE="${HOOK_DIR}/pre-push"
SOURCE="scripts/pre-push.sh"

if [ ! -f "$SOURCE" ]; then
  echo "✖ ${SOURCE} not found. Run from repo root."
  exit 1
fi

mkdir -p "$HOOK_DIR"
cp "$SOURCE" "$HOOK_FILE"
chmod +x "$HOOK_FILE"

echo "✓ pre-push hook installed → ${HOOK_FILE}"
echo
echo "What it does:"
echo "  • HARD-BLOCKS pushes to: master, main"
echo "  • WARNS + blocks pushes to: Staging (override with ALLOW_PROTECTED_PUSH=1)"
echo
echo "Bypass in an emergency:  git push --no-verify"
