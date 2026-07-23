#!/usr/bin/env bash
# =====================================================================
#  pre-push guard · UNIVERSAL
#  - HARD-BLOCKS pushes to:  master, main
#  - WARNS + blocks direct pushes to:  Staging  (always)
#  - Allows everything else (feature/*, fix/*, chore/*, etc.)
#
#  Workflow rule (all repos):
#     feature branch  →  PR  →  Staging
#     Staging  →  PR  →  master
#     master is FORBIDDEN to push to directly.
#
#  Install (per repo):   bash scripts/install-hooks.sh
#  Bypass (emergency):   git push --no-verify
#  Override Staging:     ALLOW_PROTECTED_PUSH=1 git push origin Staging
# =====================================================================

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Universal branch policy
FORBIDDEN_BRANCHES=("master" "main")
PROTECTED_BRANCHES=("Staging")

err()  { printf "${RED}✖ %s${NC}\n" "$*" >&2; }
warn() { printf "${YELLOW}⚠ %s${NC}\n" "$*"; }
ok()   { printf "${GREEN}✓ %s${NC}\n" "$*"; }
info() { printf "${CYAN}ℹ %s${NC}\n" "$*"; }

# git push passes lines like:
#   <local_ref> <local_sha> <remote_ref> <remote_sha>
# on stdin. We only care about the remote ref.
while read -r local_ref local_sha remote_ref remote_sha; do
  # Skip deletions
  if [ "$local_sha" = "0000000000000000000000000000000000000000" ]; then
    continue
  fi

  remote_branch="${remote_ref#refs/heads/}"
  local_branch="${local_ref#refs/heads/}"

  # ---- Hard block: master / main --------------------------------------
  for banned in "${FORBIDDEN_BRANCHES[@]}"; do
    if [ "$remote_branch" = "$banned" ]; then
      err "Refusing to push to '${banned}'."
      err "Rule (all repos): '${banned}' is read-only. Work in a feature branch and open a PR."
      err "Recommended: feature/*  →  PR  →  Staging"
      exit 1
    fi
  done

  # ---- Soft block: Staging (always for non-feature branches) ----------
  for protected in "${PROTECTED_BRANCHES[@]}"; do
    if [ "$remote_branch" = "$protected" ]; then
      warn "You are pushing directly to '${protected}'."
      warn "Preferred: open a PR from a feature branch (base: ${protected})."
      if [ "${ALLOW_PROTECTED_PUSH:-0}" = "1" ]; then
        warn "ALLOW_PROTECTED_PUSH=1 set — proceeding."
        warn "Reminder: this is the only branch you can hotfix to in an emergency."
        continue
      else
        err "Aborted. Use a feature branch, or set ALLOW_PROTECTED_PUSH=1 to override."
        exit 1
      fi
    fi
  done

  # ---- Friendly confirmation ------------------------------------------
  ok "Pushing ${local_branch} → origin/${remote_branch}"
done

exit 0
