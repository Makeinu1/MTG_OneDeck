---
name: mtg-onedeck-development
description: Run contract-first MTG OneDeck development with separated ChatGPT judge, implementer, and cold-auditor roles. Use for starting or continuing a milestone, implementing engine or UI work, auditing a frozen change, updating the CR-grounding queue, or preparing a verified release while preserving token economy and fake-green safeguards.
---

# MTG OneDeck development

Run exactly one milestone at a time. Preserve role separation even when every role uses ChatGPT.

## Start a milestone

1. Read the repository `AGENTS.md` (the model-independent governance canon as of 2026-07-20), the active brief, and the matching ledger entry. `CLAUDE.md` / `QWEN.md` are thin compat entries pointing here and at `AGENTS.md`.
2. Classify the task as judge, implementer, or cold audit. Never silently combine roles.
3. Read [references/cycle.md](references/cycle.md) for the selected role and phase.
4. Read [references/token-economy.md](references/token-economy.md) before delegating, running broad checks, or reopening archived context.
5. For Codex CLI sessions running the autoloop, read [references/codex-autoloop.md](references/codex-autoloop.md) for the session-based workflow (replaces Claude Code's background-agent pattern).

## Preserve the quality boundary

- Anchor deterministic Magic rulings to the pinned local CR and record rule numbers.
- Confirm card-specific behavior against English Oracle text; pin verified text in offline tests.
- Treat an effect as automated only when an executable replay proves the final `GameState` result.
- Keep unsupported compound behavior visibly guided or manual; never report a partial effect as resolved.
- Freeze a candidate tree before one cold audit. The auditor returns findings only and does not rewrite the contract. Close findings before the release full check.
- If implementation and judgment occurred in one task, retain `implemented-not-audited` until a different cold ChatGPT task audits it.

## Finish

Run milestone-specific tests while iterating, cold-audit the candidate tree, then run the full machine check once on the same release fingerprint after findings are closed. A clean pre-release audit is `AUDIT-OK-PENDING-FULL-CHECK`, never ship approval by itself. For visible UI changes, verify the required viewports and zero new browser-console errors. Use the completion report required by `AGENTS.md`.
