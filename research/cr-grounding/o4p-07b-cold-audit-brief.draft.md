# O4P-07B Cold Audit Brief

Date: 2026-08-22
Milestone: O4P-07B
Risk: R3 / BROAD
Base SHA: `ead2ed875e84b932fb56e04055dd9621a6cecb39`
Authority:

- `research/cr-grounding/o4p-07b-arbitrary-deck-ui-dynamic-genesis.contract.draft.md`
- `research/cr-grounding/o4p-07b-acceptance-brief.draft.md`

## Read-only audit scope

Audit the complete candidate tree, including all tracked and untracked files.
Do not edit files, create evidence, or infer implementation intent. Treat the
authority and executable behavior as the only intended contract.

Primary paths:

- `src/App.tsx`
- `src/components/ImportScreen.tsx`
- `src/components/online/PublicOnlineApp.tsx`
- `src/online/publicApp/**`
- `src/online/genesis/**`
- `src/online/cloudflare/index.ts`
- `src/online/cloudflare/types.ts`
- `src/online/cloudflare/runtime.ts`
- `src/online/cloudflare/persistence.ts`
- affected ordinary and `review.o4p-07b*` tests

Compatibility and forbidden-edge paths must also be inspected:

- `src/online/bootstrap/**`
- `src/online/lobby/**`
- `src/online/browser/**`
- `src/online/displayPairing/**`
- `src/online/guidedActions/**`
- `src/data/savedDecks.ts`

## Required adversarial questions

1. Can the served app submit raw text, names, Oracle text, images, complete
   definitions, Core state, or any fixed-catalog identifier through v2?
2. Can malformed, accessor-backed, sparse, oversized, secret-bearing,
   wrong-Room, wrong-submission, or stale async data mutate client state?
3. Can a non-owner see issue details or local card names, or can capability
   fragments enter DOM, projections, snapshots, Room state, replay, URLs, or
   persisted facts?
4. Can ready/start be reached without the exact current accepted head and
   snapshot relation, or can v1/v2 replacement, retry, active Room, or CAS
   races preserve stale readiness?
5. Does dynamic genesis preserve zero/multiple commanders, quantities,
   duplicate entries, identical decks, DFC face order, canonical definitions,
   deterministic seat-scoped physical IDs, replay equality, and the exact
   1,048,576-byte gate without unbounded expansion?
6. Does any v2 start path parse raw deck text, call Scryfall, or import/lookup
   `src/online/bootstrap/catalog` or the four fixed deck fixture?
7. Does create/join immediately enter v2 polling, and after start do the real
   player/table WebSocket clients, reconnect state, personal workbench, guided
   actions, and table pairing remain usable?
8. Does the import-only overlay keep a joined controller mounted, select a
   newly saved deck without auto-submit/ready, and leave Room/selection safe on
   cancel/error/unmount?
9. Are legacy v1 behavior and fixed fixtures preserved only within the O4P-07B
   compatibility boundary, with production removal correctly deferred to
   O4P-07C?

## Required output

Return findings only, classified BLOCKER/HIGH/MEDIUM/LOW with exact file and
line evidence. Report explicit zero counts for empty classes and the exact
candidate fingerprint supplied out of band. Do not mark shipment or edit the
tree.
