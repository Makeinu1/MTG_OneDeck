# O4P-06B Acceptance Brief

Date: 2026-08-21
Base SHA: `a0c33741f5a2bde35f5e9a621671f5908a6b1284`
Contract: `research/cr-grounding/o4p-06b-playable-table-command-surface.contract.draft.md`

## Required acceptance

1. The public `CoreCommandV1` discriminated union and validator expose exactly
   the frozen draw, zone movement, tap, mana, counter, token, and turn meanings;
   no open state patch or version change exists.
2. Canonical success and deterministic rejection exist for each meaning.
   Rejection preserves root identity, accepted count, digest, events, and
   protocol revision.
3. Draw performs atomic CR 121.1 / CR 400.7 reincarnation and increments
   `drawnThisTurn`; empty/short libraries reject atomically.
4. Zone movement preserves physical identity and definition, changes object
   incarnation, resets runtime, forbids same-zone/non-card misuse, and enforces
   hidden-source ownership.
5. Tap, mana, and counter commands reject no-ops, underflow/overflow, invalid
   targets, and hostile counter kinds while producing canonical frozen state.
6. Token create/remove is deterministic and collision-safe, accepts only an
   engine-synthetic exact definition, creates canonical runtime, and removes all
   token references without touching unrelated objects.
7. Turn progression uses the shipped component gates, accepts only the active
   player and valid next transition, performs the draw-step draw, empties mana
   at boundaries, and rejects nonempty-stack/pending/choice/branch skips.
8. The O4P-06A four-real-deck state drives a four-seat Protocol scenario. Every
   seat has at least one accepted ordinary command; observer, actor mismatch,
   stale, duplicate, hidden authority, underflow, turn-gate, and collision cases
   are covered.
9. Accepted commands are journaled and replay from the exact initial root to
   the exact canonical final Core digest/event transcript. Protocol receipts and
   revision equal the accepted sequence; duplicate requests are idempotent.
10. Participant and table projections preserve hidden information before and
    after the scenario. No capability or eight-character capability fragment is
    present in commands, events, issues, receipts, replay evidence, or
    projections.
11. Public exports stay within the established Core and Online module-kind
    allowlists; the implementer changes no forbidden path, dependency, version,
    configuration, document, ledger, review file, or git state.

## Hostile matrix

The Judge-owned review must include unknown/missing/accessor/symbol fields,
exotic records, sparse/extra arrays, revoked proxy, cycle, NaN/infinity,
negative zero, unsafe integer, invalid/colliding IDs, token definition drift,
wrong seat/actor, table role, disconnected participant, stale base revision,
duplicate and command-ID reuse mismatch. Secret inputs must never appear in
public errors or evidence.

## Implementer iteration commands

Run only affected checks while iterating:

```sh
npx vitest run --project core src/engine/core/closure src/engine/core/tabletop
npx vitest run --project core src/online/protocol src/online/headless
npx eslint src/engine/core/closure src/engine/core/tabletop src/engine/core/index.ts src/online/headless/__tests__
npx tsc -b
git diff --check
```

The Judge owns the final `review.*`, architecture checks, candidate fingerprint,
cold audit, full `npm run check`, git, ledger, CI, and publication.

## Evidence format

The implementation report lists changed paths, payload discriminants, targeted
command results, acceptance item 1-11 disposition, defers, and unresolved
points. It must not claim audit, full-check, shipment, CI, Pages, or Cloudflare.
