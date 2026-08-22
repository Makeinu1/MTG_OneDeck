# O4P-07B Acceptance Brief

Date: 2026-08-22
Base SHA: `a650c5edc09afc03b59e3da9f55950485eec140d`
Authority: `o4p-07b-arbitrary-deck-ui-dynamic-genesis.contract.draft.md`

## Executable acceptance

1. The served Online app receives every saved deck's ordered resolved entries,
   selects any catalog-external deck, and sends an exact v2 request containing
   only section, quantity, Scryfall ID, and Oracle ID plus required metadata.
   It never sends deck text, names, CardDef, Oracle text, images, or Core state.
2. The in-context import action resolves and saves a new list without losing an
   existing Room/session, selects it immediately, and never auto-submits or
   auto-readies. Cancel/error/unmount and sideboard rejection are safe.
3. Closed v2 projection/result parsers reject extra/missing/accessor/sparse/
   oversized/secret-bearing/wrong-Room/wrong-submission data. Create/join may
   consume v1 credentials, but all later polling and mutations use v2 with no
   v1 fallback.
4. Owner issues map the exact entry index to a local Japanese `《カード名》`
   message and correction/retry action. Other seats, host/table projections,
   DOM outside the owner alert, URLs, facts/logs, and responses expose only the
   four public deck states and no issue/entry/name/ID/definition/capability.
5. Submitting or replacing a deck clears ready before resolution. Local ready
   is disabled until current `accepted`; failed/resolving submissions cannot be
   ready. Host start is disabled until all four occupied seats are accepted and
   ready. A retry uses a fresh submission ID and duplicate activation is inert.
6. Pre-WebSocket UI says `ロビー待機中`/`デッキ確認中`, never offline.
   Started WebSocket UI alone uses `接続中`/`オンライン`/`再接続中`; unknown
   transport/protocol failures alone use the generic Japanese error.
7. Repository v2 readiness proves the exact accepted head/snapshot relation on
   write and read. Legacy v1 view clamps v2-only deck/ready/lifecycle facts;
   corrupt or mixed v1/v2 state cannot project ready or start.
8. Dynamic genesis consumes four SQLite snapshots without raw parsing,
   Scryfall calls, or fixed-catalog lookup. Definition conversion is canonical,
   duplicate definitions are consistent, and DFC faces remain ordered.
9. Expansion is seat/input/copy deterministic. Zero and multiple commanders,
   commander quantities, arbitrary totals, duplicate entries, and identical
   decks are accepted; every commander copy enters command, every main copy
   enters its owner's library, and physical IDs never collide across seats.
10. Huge safe-integer quantities fail boundedly as
    `ROOM_GENESIS_TOO_LARGE`. Exact Core/protocol artifacts stay at or below
    1,048,576 bytes; size or construction failure mutates no Room/lobby/ready/
    snapshot/security/checkpoint/replay state.
11. Start CAS rejects any concurrent replacement of a head/revision/submission/
    input/snapshot digest. Successful start creates the deterministic active
    revision-zero Room, table observer, empty journal/replay, and equal final
    Core digest; recreation/reconnect reads the same frozen definitions.
12. Existing v1-only tests, Solo deck import/library/start, dependencies,
    configuration, CR authority, and fixed catalog fixture bytes remain green.
    O4P-07C removal remains explicitly deferred.

## Verification order

The implementer runs only affected ordinary unit/integration/component tests,
affected ESLint, TypeScript build, and diff check. The Judge adds adversarial
`review.o4p-07b*` and architecture/import-graph assertions, freezes one
candidate fingerprint, obtains a fresh Luna/xhigh BROAD audit, and then runs
the unchanged-fingerprint full check. The Judge alone performs the three
viewport/browser-console evidence, exact-head CI/Pages/Worker compatibility,
ledger shipment, usage measurement, and clean transition before O4P-07C.
