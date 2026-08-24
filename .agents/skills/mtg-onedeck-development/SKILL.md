---
name: mtg-onedeck-development
description: Run contract-first MTG OneDeck development with separated ChatGPT judge, implementer, and cold-auditor roles. Use for starting or continuing a milestone, implementing engine or UI work, auditing a frozen change, updating the CR-grounding queue, or preparing a verified release while preserving token economy and fake-green safeguards.
---

# MTG OneDeck development

Run exactly one milestone candidate at a time. Preserve role separation even
when every role uses ChatGPT. Normalize free-form requests with
[references/request-normalization.md](references/request-normalization.md).
A user-authorized machine-readable active program may use one supervisor, but
each milestone executes in fresh worker/auditor context and returns only a
compact terminal packet; candidates and worker histories never overlap.

## Start a milestone

1. Normalize the original request. Do not make the user write the schema, and
   do not infer ship or external-write authority from “finish” or broad approval.
2. Read the repository `AGENTS.md`, the verified `codex:context` projection,
   and the active brief. Read the matching contract or ledger entry only when
   those sources do not establish the required claim; read the full ledger or
   history only for a projection integrity error, true ambiguity, or an
   explicitly required ruling. `CLAUDE.md` / `QWEN.md` are thin compatibility
   entries.
3. Classify the task as judge, implementer, or cold audit. Never silently combine roles.
4. Read `docs/judge-protocol.md` for the applicable ruling and STOP boundary.
5. Read [references/document-governance.md](references/document-governance.md) for the selected role, risk lane, and phase.
6. Do not read `references/cycle.md`, `references/token-economy.md`, or
   `references/codex-autoloop.md` during a normal start; they are compatibility
   pointers only and contain no operative rules.
7. Start implementers and auditors with fresh context. On the current Codex
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
Hard counters and authority do not reset when a repair, continuation, metadata
commit, or task is renamed.
