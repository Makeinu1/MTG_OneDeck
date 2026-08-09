# O4P-01H Orchestration Plan

- Milestone: `O4P-01H`
- Name: Universal Game Object Registry & Non-Card Stack Substrate V2
- Required ancestor: `13350f5a7cf32e2c59abc6c5206881b79e50f4a7`
- Initial `BASE_SHA`: `13350f5a7cf32e2c59abc6c5206881b79e50f4a7`
- Judge: orchestrator; user ruling `2026-08-09`

## Goal

Add an additive, mode-neutral V2 object registry and runtime substrate for
physical-card objects, battlefield tokens, card spells, spell copies,
activated abilities, and triggered abilities while preserving every V1 public
contract and Solo runtime boundary.

## Gates

1. Register the domain in both ledger collections as `pending` and commit the
   registration as `PLAN_SHA`.
2. Run four independent grounding lanes, adjudicate them against the pinned
   CR, and freeze the contract before implementation.
3. Author independent review tests, implement disjoint ID/object/registry/
   runtime slices, integrate exports and machine gates, and freeze a candidate.
4. Run one context-free cold audit; close BLOCKER/HIGH findings before the
   fingerprint-matched full check.
5. Obtain CI and Pages evidence before promoting the two ledger entries to
   `shipped`.

## Parallel lane boundaries

Grounding lanes: `R` taxonomy matrix, `A` object-ID migration, `B` token
runtime, and `C` stack non-card objects. Implementation lanes are disjoint:
`D` ID foundation, `E` token contracts, `F` stack contracts, `G` registry,
`H` runtime, and `T` fixture/normal assets. No lane edits git, ledger, docs,
review-owned tests, package-lock, dependencies, Solo source, Online runtime,
UI, or version values.

## Explicit boundary

This milestone is structural only. Object-creation commands, priority,
APNAP, trigger detection, resolution, targeting, mode/X announcement, cost
payment, copiable-values derivation, CR707 automation, token/copy cease rules,
projection, visibility, Room, revision, WebSocket, Cloudflare, and UI remain
deferred.

## Preflight evidence

- Worktree clean at start.
- Required ancestor present.
- `npm ci` succeeded.
- Baseline `npm run check` passed: core 1540 tests, DOM 1709 tests, build.
- `npm run check:forbidden` passed: `FORBIDDEN 変更なし(走査 0 ファイル)`.
- Latest `deploy-pages.yml` on `main` succeeded: run `31319071093`.

