# Contributing — branch policy

> Applies to **all repos** under this organization.

## Branch hierarchy (the only allowed flow)

```
feature/*   ──PR──▶   Staging   ──PR──▶   master
```

- `master` is **read-only**. Never push to it directly. Never target it in a PR.
- `Staging` is the integration branch. Hotfixes go through a feature branch and a PR — **no direct pushes**, unless explicitly authorized.
- All work happens in a `feature/*`, `fix/*`, or `chore/*` branch.

## Why

- Keeps `master` deployable at all times.
- Keeps `Staging` reviewable.
- Avoids the "we don't know where the bug came from" problem.

## Daily workflow

```bash
# 1. Install the guard once per clone
make install-hooks

# 2. Create a feature branch off Staging
make feature NAME=feat/your-thing

# 3. Work, commit, push
git add -A
git commit -m "feat: ..."
git push origin feat/your-thing

# 4. Open a PR with base = Staging
make pr NAME=feat/your-thing
```

## What the guard blocks

| Target | Behavior |
|---|---|
| `master` / `main` | **HARD BLOCK** — refuses to push |
| `Staging` | Warns + blocks; override with `ALLOW_PROTECTED_PUSH=1` |
| anything else | Allowed |

## Emergency bypass

```bash
git push --no-verify
```

Only for true emergencies. Always follow up with a PR that explains why.

## Enforcement

The `scripts/pre-push.sh` hook is installed locally and runs on every `git push`. CI on `Staging` and `master` also rejects direct pushes via branch protection rules on the GitHub side (configure there too).
