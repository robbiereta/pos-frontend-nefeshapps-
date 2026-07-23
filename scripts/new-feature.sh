#!/usr/bin/env bash
# Quick helper: create a new feature branch off Staging.
# Usage:  bash scripts/new-feature.sh feat/whatever

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

BRANCH="${1:-}"
if [ -z "$BRANCH" ]; then
  echo "Usage: $0 <branch-name>   e.g. $0 feat/cool-thing"
  exit 1
fi

# Never branch from master
current="$(git branch --show-current)"
if [ "$current" = "master" ] || [ "$current" = "main" ]; then
  echo "Refusing: you're on '$current'. Check out Staging first."
  exit 1
fi

git fetch origin Staging
git checkout -b "$BRANCH" "origin/Staging"
echo "Created '$BRANCH' off origin/Staging"
