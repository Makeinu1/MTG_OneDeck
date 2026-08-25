# GOV-CODEX-57 implementer brief

Milestone ID: `GOV-CODEX-57-2026-08`
Base SHA: `027aed8b152421f0aa101c81eefcf766fbfc803b`
Contract: `research/cr-grounding/gov-codex-57-autonomy-player-journey.contract.draft.md`

Implementer-owned paths:

- `scripts/codex-context.mjs`
- `scripts/checks/release-preflight.mjs`
- `scripts/checks/terminal-metadata.mjs`
- ordinary tests under `scripts/__tests__/` that do not contain `review.`

Goal: implement the machine-readable active-program projection, release
preflight, terminal metadata lane, and their ordinary tests.

Constraints:

- Do not edit git, `review.*`, AGENTS, docs, ledger, workflow, package files, or
  any product/engine/UI source.
- You are not alone in the worktree. Preserve Judge-owned concurrent changes
  and do not revert or rewrite them.
- Preflight is read-only and bounded. No network access and no full check.
- Terminal lane must fail closed rather than guessing semantic equivalence.

Done when:

- Focused ordinary tests pass.
- `codex-context` supports the exact policy schema in the contract.
- Both new CLIs have deterministic JSON output, strict arguments, and negative
  fixtures for the three historical failures.
