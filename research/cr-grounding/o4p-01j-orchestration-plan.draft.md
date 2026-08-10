# O4P-01J Orchestration Plan

Milestone: O4P-01J Atomic Stack Commit, Retarget & Removal Transaction V1
Date: 2026-08-10
Authority: user-ruling-2026-08-10
Initial BASE_SHA: 2cd27710e690ae12cdcacfde6d9ac544ab85201f
Required ancestor: 444f538221139dc31aeb8fcfa93f879a0fe3fd67

## Goal

Add one pure, deterministic, input-preserving transaction surface that
constructs and validates Object Registry V2, Object Runtime V2, and Stack
Announcement V1 together. The surface covers card-spell commit, synthetic
stack-object commit, immutable target replacement, card-spell movement out of
the stack, and synthetic-object cease.

## Gate 0 reconciliation

The O4P-01J identifier already existed as a pending entry from the
user-authorized 2026-08-10 roadmap rebaseline. This plan does not create a
second entry. It replaces only that existing pending O4P-01J domain and
plannedSequence payload with the complete milestone-specific contract scope.
O4P-01I and all shipped evidence remain unchanged.

## Constraints

- Preserve O4P-01G/H/I public contracts, fixtures, Solo source, versions,
  package-lock, dependencies, docs, ledger history, Online runtime, store,
  components, data, and UI.
- No proposal, legality, payment, priority, APNAP, trigger detection,
  resolution, copyable-values derivation, copy effect, event/command envelope,
  projection, protocol, or UI work.
- Every operation validates the input bundle first, builds candidate Registry,
  Runtime, and Announcement values, cross-validates the candidate bundle, and
  exposes only a successful deeply frozen result.
- No input sorting, trimming, deduplication, defaulting, mutation, random IDs,
  time reads, network access, or unknown-field tolerance.
- Orchestrator owns ledger, review tests, integration, git, candidate freeze,
  audit, CI, Pages, and ship. Implementers and analysts do not use git or edit
  protected judge-owned files. Cold auditor edits nothing.

## Waves

1. Five independent grounding lanes: CR matrix, V2 transition reuse,
   synthetic lifecycle, retarget structure, and atomic failure/result metadata.
2. Judge-owned contract freeze after pinned-CR adjudication.
3. Independent Acceptance Author creates review tests from the frozen contract.
4. Foundation lane adds the transaction bundle, strict validation, shared
   internal helpers, and transaction error type.
5. Two parallel commit lanes add card-spell and synthetic-stack commits.
6. Two parallel mutation lanes add immutable retarget and stack removal.
7. Two parallel test-asset lanes add fixture/scenario evidence and the
   TypeScript Compiler API architecture boundary test.
8. Judge-owned integration adds public exports, verifier, and machine-check
   registration, then freezes a candidate and requests a cold audit.
9. After BLOCKER/HIGH=0, run the release full check on the same fingerprint,
   record audited evidence, obtain CI/Pages evidence, and ship if all gates
   remain green.

## Atomic result boundary

The public result always contains one complete
`CoreStackTransactionBundleV1` plus only operation-specific object identifiers.
No partial Registry, Runtime, or Announcement result is exposed on failure.
Errors use the frozen O4P-01J code union and deeply frozen nested issues.

## Deferred

Action proposal, costs, payment, timing and target legality, priority, APNAP,
trigger detection and ordering, resolution, target rechecking, effect
execution, copyable-values derivation, copy execution, domain events, command
metadata, revision, actor/authority/visibility/projection, Online, Cloudflare,
WebSocket, UI, and Solo connection remain outside this milestone.

## Done when

The frozen contract, independent review tests, implementation waves, committed
fixture, architecture gate, verifier, normal/property tests, cold audit,
full-check, CI, Pages evidence, and both audited/shipped ledger transitions
exist. The final status is `shipped` only after BLOCKER/HIGH=0, all required
checks pass, and the deployed assets are verified.
