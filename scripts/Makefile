# Nefesh frontend — safe-branch workflow
# NEVER push to master. Always go feature/... → Staging.

.PHONY: install-hooks feature help

help:
	@echo "Available targets:"
	@echo "  make install-hooks   Install the pre-push guard (block master, warn on Staging)"
	@echo "  make feature NAME=feat/cool   Create a new feature branch off Staging"
	@echo "  make pr NAME=feat/cool  Remind you to open a PR (base: Staging)"
	@echo ""
	@echo "Rule of thumb: never touch 'master'. Work in a feature branch, PR into Staging."

install-hooks:
	@bash scripts/install-hooks.sh

feature:
	@test -n "$(NAME)" || (echo "✖ Use: make feature NAME=feat/your-thing" && exit 1)
	@bash scripts/new-feature.sh "$(NAME)"

pr:
	@test -n "$(NAME)" || (echo "✖ Use: make pr NAME=feat/your-thing" && exit 1)
	@echo "Open: https://github.com/robbiereta/pos-frontend-nefeshapps-/pull/new/$(NAME)"
	@echo "IMPORTANT: set the base branch to 'Staging' (NOT master)."
