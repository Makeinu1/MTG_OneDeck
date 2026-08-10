# O4P-01I Orchestration Plan

- Milestone: `O4P-01I`
- Name: Stack Announcement Payload & Lifecycle V1
- Parent: Online Four-Player Commander MVP
- Required ancestor: `05963480e87788a6362b3e188ce1c558c53a003d`
- BASE_SHA: `aad8b24b9a0fcfe0a8dad51dc28095d1a0348966`
- Judge: Orchestrator, under the user-ruling exception dated 2026-08-10

## Goal

Add an independent mode-neutral core slice that stores the committed announcement
payload for card spells, spell copies, activated abilities, and triggered
abilities already represented on the stack. The slice is structural and
committed-only: it does not implement proposal, payment, legality, priority,
resolution, copying, projection, protocol, or UI.

## Preservation and constraints

- Preserve the O4P-01H Object Registry V2 and Runtime V2 contracts exactly.
- Preserve all existing V1/V2 exports, Solo source, snapshots, version values,
  and fixtures.
- Do not add announcement fields to identity or runtime objects.
- Keep stack order derived from the existing bottom-to-top stack array; do not
  store a second stack order.
- Do not persist proposal, payment, legality, resolution, actor, or decision
  authority state.
- Implement only additive files under the stack core lane plus explicitly
  authorized exports, machine checks, fixtures, and independent tests.
- Implementers do not use git, edit the ledger, docs, AGENTS.md, package-lock,
  dependencies, or review tests.

## Fixed CR grounding

Use only the pinned CR 2026-06-19. Grounding includes CR 115, 405.1-405.6,
601.2 and 601.2a-i, 602.2 and 602.2a-b, 603.3 and 603.3b-d, 608.2b,
707.10 and 707.10c, and 727.1-2. No web refresh or O4P-00B.

## Execution lanes

1. Five independent read-only grounding lanes produce CR, Solo-reuse, target,
   mode/cost/copy, and committed-lifecycle drafts.
2. The judge reconciles them against the fixed CR and freezes the contract.
3. An independent Acceptance Author writes review pins from the frozen contract.
4. Serial implementation creates primitives, parallel payload contracts, then
   the integrated record/slice and canonical validator.
5. Independent fixture and architecture lanes add non-production test assets.
6. The judge integrates exports and machine checks, freezes a fingerprint, and
   requests a context-free cold audit.
7. Only BLOCKER/HIGH-free audit plus full check permits audited/release gates.

## Gate records

- PLAN_SHA is the ledger/plan commit and common grounding base.
- CONTRACT_SHA is the judge-owned frozen contract commit.
- FOUNDATION_SHA, PAYLOAD_SHA, SLICE_SHA, and TEST_ASSET_SHA identify each
  implementation wave after changed-file and targeted-check review.
- Candidate evidence includes exact changed files, tests, check:forbidden,
  package-lock/dependency/version/Solo/Online preservation, and fingerprint.
- Cold audit remains independent and read-only; MEDIUM findings are fixed or
  explicitly ledger-recorded with contract/CR rationale.

## Acceptance boundary

The root slice has exact stack-object key parity, record-kind parity, immutable
choice snapshots, historical target references, deterministic canonical order,
strict fail-closed validation, fresh deep-frozen success values, and no
transaction implementation. Future O4P-01J owns atomic stack commit, retarget,
and removal.

## Initial evidence

- `npm ci`: PASS
- `npm run check`: PASS on BASE_SHA
- `npm run check:forbidden`: PASS, FORBIDDEN 0
- `git diff --check`: PASS
- latest `deploy-pages.yml` on `main`: run `31332914988`, Success

Status at registration: `pending`.
