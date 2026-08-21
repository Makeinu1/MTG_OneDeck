---
name: mtg-onedeck-development
description: Run contract-first MTG OneDeck development with separated ChatGPT judge, implementer, and cold-auditor roles. Use for starting or continuing a milestone, implementing engine or UI work, auditing a frozen change, updating the CR-grounding queue, or preparing a verified release while preserving token economy and fake-green safeguards.
---

# MTG OneDeck development

Run exactly one milestone candidate at a time. Preserve role separation even
when every role uses ChatGPT. A user-authorized machine-readable active program
may run serial milestone cycles in one supervisor task, but never overlaps
candidates or worker context.

## Start a milestone

1. Read the repository `AGENTS.md`, the verified `codex:context` projection,
   the active brief, and the matching ledger entry. `CLAUDE.md` / `QWEN.md`
   are thin compatibility entries.
2. Classify the task as judge, implementer, or cold audit. Never silently combine roles.
3. Read `docs/judge-protocol.md` for the applicable ruling and STOP boundary.
4. Read [references/document-governance.md](references/document-governance.md) for the selected role, risk lane, and phase.
5. Do not read `references/cycle.md`, `references/token-economy.md`, or
   `references/codex-autoloop.md` during a normal start; they are compatibility
   pointers only and contain no operative rules.
6. Start implementers and auditors with fresh context. On the current Codex
   collaboration surface use `fork_turns: "none"` and pass only the six-field
   implementer envelope or frozen audit-brief path plus candidate fingerprint.

## Preserve the quality boundary

- Anchor deterministic Magic rulings to the pinned local CR and record rule numbers.
- Confirm card-specific behavior against English Oracle text; pin verified text in offline tests.
- Treat an effect as automated only when an executable replay proves the final `GameState` result.
- Keep unsupported compound behavior visibly guided or manual; never report a partial effect as resolved.
- Freeze an R2/R3 candidate tree before one cold audit. The auditor returns findings only and does not rewrite the contract. Close findings before the release full check. The only R0 exception is the deterministic terminal-metadata rule in the workflow reference.
- If implementation and judgment occurred in one task, retain `implemented-not-audited` until a different cold ChatGPT task audits it.

## Finish

Run milestone-specific tests while iterating, cold-audit the R2/R3 candidate tree, then run the full machine check once on the same release fingerprint after findings are closed. A clean pre-release audit is `AUDIT-OK-PENDING-FULL-CHECK`, never ship approval by itself. For visible UI changes, verify the required viewports and zero new browser-console errors. Use the completion report required by `AGENTS.md`. After a shipped cycle, a program supervisor may continue only through the clean exact-head transition gate in the workflow reference.
