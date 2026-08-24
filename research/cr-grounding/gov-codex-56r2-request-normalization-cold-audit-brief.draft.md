# GOV-CODEX-56R2 Fresh-Context Cold-Audit Brief

Milestone: `GOV-CODEX-56R2-2026-08`
Base SHA: `2a50db07f3962a11ec5a77b93bedc74ca4f628b6`
Risk: R3 / BROAD governance
Mode: read-only, fresh context, independent from implementation

## Candidate paths

- `AGENTS.md`
- `.agents/skills/mtg-onedeck-development/SKILL.md`
- `.agents/skills/mtg-onedeck-development/references/document-governance.md`
- `.agents/skills/mtg-onedeck-development/references/request-normalization.md`
- `.codex/config.toml`
- `research/cr-grounding/cr-backbone-ledger.json`
- `research/cr-grounding/gov-codex-56r2-request-normalization.contract.draft.md`
- `research/cr-grounding/gov-codex-56r2-request-normalization-acceptance.draft.md`
- `research/cr-grounding/gov-codex-56r2-request-normalization-cold-audit-brief.draft.md`
- `scripts/codex-context.mjs`
- `scripts/__tests__/review.codex-ops.test.mjs`
- `scripts/__tests__/review.check-gates.test.mjs`
- `src/test/architecture/review.gov-codex-56-program-orchestration.test.ts`
- `src/test/architecture/review.gov-codex-56r2-request-normalization.test.ts`
- `src/test/architecture/review.o4p-08-roadmap-registration.test.ts`
- `src/engine/core/transition/__tests__/cardZoneTransitionProperty.test.ts`

## Audit questions

1. Does the LLM, rather than the user, convert ordinary prose into exactly the
   seven canonical fields without silently expanding scope or authority?
2. Are `inspect`, `plan`, `change`, `goal`, and explicit `+ ship` inferred
   conservatively, especially for “finish”, “complete”, and “do not stop”?
3. Are product quality, cold audit, full check, exact-head CI, deployment,
   browser, clean-worktree, and secret-safety gates preserved?
4. Are context, compaction, agent, correction, full-check, push/CI, wait, and
   browser counters coherent, hard, per milestone, and non-resettable?
5. Does progressive disclosure remove active-context duplication without hiding
   authority-bearing rules or contradicting the existing workflow?
6. Do the two ledger entries remain unique and share identical milestone data?
7. Does Sol/medium remain the ordinary intake default while the R3/BROAD auditor
   remains explicitly Sol/high and read-only?
8. Do executable tests cover the contract rather than merely asserting a title
   or filename, and is every changed path within the governance-only boundary?
9. Is the timeout repair local to the two fixed-seed property tests, exactly
   15 seconds, with no reduction in generators, seeds, run counts, assertions,
   Core parallelism, or the global timeout?
10. Do the full-check repairs preserve the original O4P-08 evidence and audit
    order while binding historical scope checks to their closure commit instead
    of blocking legitimate later milestones?

## Audit boundary

- Do not edit files, commit, push, deploy, or run the repository full check.
- Targeted read-only or review tests are allowed when needed to challenge a
  claim.
- Do not reproduce Room IDs, invitations, capabilities, credentials, or raw
  private errors in the report.

## Required report

- Findings first, ordered `BLOCKER`, `HIGH`, `MEDIUM`, `LOW`, with exact file and
  line evidence plus a concrete correction.
- Severity totals as `BLOCKER/HIGH/MEDIUM/LOW`.
- If and only if `BLOCKER = 0` and `HIGH = 0`, conclude
  `AUDIT-OK-PENDING-FULL-CHECK`; otherwise conclude `AUDIT-REJECTED`.
