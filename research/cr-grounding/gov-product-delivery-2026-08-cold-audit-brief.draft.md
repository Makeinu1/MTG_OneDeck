# GOV-PRODUCT-DELIVERY-2026-08 cold audit brief

## Audit type

R3 / BROAD, findings only. Do not edit any file.

## Candidate

Base SHA: `8b906a888facc49213f51071d660f42098cc174c`

The supervisor supplies the frozen candidate fingerprint separately. Reject
the audit if the current tree does not match it.

## Authorized paths

- `docs/product-requirements.md`
- `.agents/skills/mtg-onedeck-development/references/delivery-policy.md`
- `.agents/skills/mtg-onedeck-development/SKILL.md`
- `.agents/skills/mtg-onedeck-release/SKILL.md`
- `.claude/commands/ship.md`
- `AGENTS.md`
- `docs/README.md`
- `.agents/skills/mtg-onedeck-development/references/document-governance.md`
- `research/cr-grounding/gov-product-delivery-2026-08-implementation-brief.draft.md`
- `research/cr-grounding/gov-product-delivery-2026-08-product-requirements.draft.md`
- `research/cr-grounding/gov-product-delivery-2026-08-delivery-policy.draft.md`
- `research/cr-grounding/gov-product-delivery-2026-08-release-skill.draft.md`
- `research/cr-grounding/gov-product-delivery-2026-08-cold-audit-brief.draft.md`
- `research/cr-grounding/archive/governance/gov-product-delivery-2026-08-cold-audit-record-2026-08-29.md`
- `research/cr-grounding/cr-backbone-ledger.json`
- `research/cr-grounding/supervisor-events/GOV-PRODUCT-DELIVERY-2026-08.json`
- `scripts/codex-program-step.mjs`
- `scripts/codex-context.mjs`
- `scripts/lib/supervisor-authority.mjs`
- `scripts/checks/guard-impact.mjs`
- `scripts/checks/verify-o4p-05d-production-release-closure.ts`
- `scripts/__tests__/governanceSupervisor.test.mjs`
- `scripts/__tests__/codexContext.test.mjs`
- `scripts/__tests__/forbidden-policy.test.mjs`
- `src/test/architecture/review.o4p-05d-production-release-closure.test.ts`
- `src/test/architecture/review.o4p-06-roadmap-registration.test.ts`
- `src/test/architecture/review.o4p-07-roadmap-registration.test.ts`
- `src/test/architecture/review.o4p-08-roadmap-registration.test.ts`
- `src/test/architecture/review.o4p-09-roadmap-registration.test.ts`
- `src/test/architecture/review.o4p-09c-pregame-lifecycle.test.ts`
- `src/test/architecture/review.gov-codex-56-program-orchestration.test.ts`
- `src/test/architecture/review.gov-codex-56r2-request-normalization.test.ts`
- `src/test/architecture/review.gov-codex-57-autonomy-player-journey.test.ts`
- `src/test/architecture/review.gov-codex-58a-supervisor-enforcement.test.ts`
- `.claude/loop-state.md` as volatile candidate state only.

## Acceptance questions

1. Are product WHY/WHAT and delivery HOW/progress separated with exactly one
   discoverable authority for each, while detailed mechanics stay in document
   governance and implementation meaning stays in existing contracts?
2. Does the product authority faithfully capture the agreed immediate outcome,
   attention model, shared-assets/mode-specific-composition rule, self/opponent
   information model, causal stack, Display A/B roles, Arena-relative quality,
   accessibility, and non-goals without claiming current implementation?
3. Does the delivery authority directly address the observed failure mode:
   player outcomes displaced by long audit/governance loops, design decisions
   returned to a non-designer user, premature full checks, repeated context,
   and substrate reported as product progress?
4. Are secret safety, authorization, shared-state integrity, recoverability,
   guided/manual honesty, role separation, and final release quality preserved?
5. Does `user-reauthorize` append, rather than rewrite, exactly one verified
   user-ruling epoch; atomically synchronize domain, plannedSequence, loop, and
   tracked authority; bind the changed acceptance and tree fingerprint; reopen
   the same candidate; and fail closed for downgrade, partial collection,
   malformed input, stale predecessor hash, or write failure?
6. Is release authority raised only for this domain while the active-program
   default and later domains remain unchanged, and does the candidate preserve
   base, identity, structural counters, lineages, waits, and release head?
7. Is `mtg-onedeck-release` a thin operator entry with prepare/ship/resume/
   verify modes that routes to existing gates, avoids a parallel state machine,
   does not infer authority, and replaces the broken `/ship` compatibility
   reference?
8. Is the inserted milestone a bounded second substrate followed immediately
   by O4P-09F, with F-J product semantics unchanged?
9. Do links and document ownership avoid duplicate authority, circular routing,
   obsolete one-player-only positioning, or a requirement for Display B?
10. Are exact ratios and pixel values correctly left to prototype evidence while
   the user retains Goal, scope, quality, North-Star, and external decisions?

## Required evidence

- Read `AGENTS.md`, both new authorities, document governance, and the exact
  new ledger/plannedSequence entries.
- Inspect the full authorized diff against the base SHA.
- Run `npm run check:docs`, the targeted supervisor/context tests, the release
  Skill validator, and any bounded static inspection needed for a finding. Do
  not run the release full check or perform an external action.
- Run the focused guard-policy regression and verify that neither current nor
  base supervisor-event records can become guard or predecessor-reference
  sources when tracked, staged, or crossing the two-megabyte scan threshold.
- Return severity-counted BLOCKER/HIGH/MEDIUM/LOW findings with exact path and
  line evidence. If no finding exists, return `AUDIT-OK-PENDING-FULL-CHECK`.

## Exclusions

Do not assess or request O4P-09F implementation, product source changes,
dependency or CR changes, an actual commit/push/deploy/ship during audit, a
fixed screen ratio, or complete Arena rules automation.
