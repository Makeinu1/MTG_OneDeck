# O4P-07A Dynamic Card Resolution and Room Snapshot Contract

Date: 2026-08-22
Authority: user-ruling-2026-08-22-remove-fixed-online-catalog
Base SHA: `55fe011700bd6bb10a699e1bd431f0bf12cc40cb`
Risk: R3 / BROAD
Status: frozen for implementation

## Goal and boundary

Add a closed v2 deck-submission protocol whose card definitions are resolved by
the Room Durable Object through Scryfall and frozen in seat-scoped SQLite
snapshots. Replacement, retry, idempotency, stale completion, restart, size,
and privacy behavior must be deterministic and executable.

O4P-07A does not switch the served client, ready/start path, or Core genesis to
v2 and does not remove the fixed catalog. Those are O4P-07B/C. Existing v1
clients remain functional unless that same seat explicitly starts a v2
replacement.

## Closed request

```ts
type OnlineDeckSubmitV2 = {
  kind: 'online-forming-lobby-deck-submit-v2'
  schemaVersion: 2
  participantId: string
  seatCapability: string
  deckId: string
  submissionId: string
  entries: Array<{
    section: 'commander' | 'main'
    quantity: number
    scryfallId: string
    oracleId: string
  }>
}
```

The root and every entry accept exactly the named own enumerable data fields.
`entries` is a dense non-empty ordinary array. `deckId`, `submissionId`,
participant, and capability use the existing identifier/capability validators.
Scryfall and Oracle IDs are lower-case canonical UUIDs. Quantity is a positive
safe integer. Input order, duplicate IDs, duplicate entries, zero commanders,
multiple commanders, and arbitrary total quantity are preserved. Sideboards
and EDH legality checks are absent.

The canonical UTF-8 JSON for `{ deckId, entries }` must not exceed 262,144
bytes. The existing 1,048,576-byte HTTP body gate remains earlier and
fail-closed. Invalid input performs no Scryfall request or state mutation.

## Result and private issues

The authenticated submitter receives a closed v2 result containing only
`kind`, `schemaVersion`, `roomId`, `submissionId`, `state`, `issues`, and the
safe public v2 projection. The stable result kind is
`online-forming-lobby-deck-result-v2`; schema version is 2. Each issue contains
exactly `code`, `entryIndex`, and `retryable`. `entryIndex` is a zero-based
integer for entry-specific failures and `null` otherwise. It never includes a
card name, ID, definition, capability, or raw Scryfall body.

O4P-07A issue codes are:

- `EMPTY_LIST`, `INVALID_SECTION`, `INVALID_QUANTITY`, `INVALID_CARD_ID`;
- `CARD_NOT_FOUND`, `IDENTITY_MISMATCH`, `SCRYFALL_UNAVAILABLE`;
- `SUBMISSION_CONFLICT`, `STALE_RESOLUTION`, `SNAPSHOT_TOO_LARGE`.

Known validation/resolution failures use this private structured body.
`SCRYFALL_UNAVAILABLE` is retryable and requires a fresh `submissionId`.
Unknown transport/protocol/runtime failures retain the generic response.

## Public projection

`GET /api/online/rooms/<roomId>/lobby` remains the exact v1 projection.
`GET /api/online/rooms/<roomId>/lobby?schemaVersion=2` returns the closed
`online-forming-lobby-projection-v2` with schema version 2, existing safe Room
identity/lifecycle fields, and exactly four seats. A v2 seat contains only
`seatIndex`, `corePlayerId`, `participantId`, `deckState`, and `ready`.
`deckState` is `none | resolving | accepted | needs-attention`.

The v2 projection exposes no deck ID, submission ID, digest, entry, issue,
Scryfall/Oracle ID, definition, deck text, capability, or bearer fragment. A
host and another seat therefore learn only facts such as “seat 3 needs
attention”; private failure details remain available only in the authorized
submission response.

## Scryfall authority

Production resolution uses `POST https://api.scryfall.com/cards/collection`
with exact Scryfall print IDs, at most 75 unique IDs per request. More than 75
unique IDs is resolved in deterministic sequential batches. Results are keyed
back to every original entry in input order. Returned `id` must equal the
requested `scryfallId`; normalized `oracle_id ?? id` must equal the submitted
`oracleId`. Missing IDs yield `CARD_NOT_FOUND`; either identity mismatch yields
`IDENTITY_MISMATCH` at the original entry index.

Only server-resolved `CardDef` values enter a snapshot. Production never reads
client CardDef/Oracle/name fields and never falls back to them for HTTP, parse,
shape, throttle, timeout, or other Scryfall failures. The resolver is injectable
only as an internal test dependency; the shipped default always calls
Scryfall.

## Persistence, idempotency, and CAS

SQLite holds three separate concepts:

1. one current head per seat with public state, current submission ID/content
   digest, monotonically increasing safe-integer revision, and accepted
   snapshot digest;
2. submission history keyed by seat and `submissionId`, containing canonical
   input, content digest, and owner-private terminal issues for persistent
   idempotency/restart;
3. one accepted resolved snapshot row per seat containing ordered entries and
   complete server-resolved definitions.

New tables are STRICT. Capability/bearer values are forbidden from all three
rows. Identical decks across seats are permitted and may have the same snapshot
digest; storage and later physical-card identity remain seat-scoped.

The same seat plus `submissionId` plus identical canonical content is
idempotent across concurrent requests and Durable Object recreation. Accepted
or needs-attention outcomes are replayed without a new Scryfall request. The
same ID with different content returns `SUBMISSION_CONFLICT` without mutation.
A retry after a retryable terminal failure uses a fresh `submissionId`.

Beginning a fresh submission is one transaction: authorize the seat, increment
its revision, set `resolving`, invalidate/delete the prior accepted snapshot,
and clear that seat's legacy `deckId`, `deckText`, and `ready`. A v1 deck submit
symmetrically invalidates any v2 head/snapshot for that seat. Thus neither path
can leave an apparently ready stale deck.

Resolution happens after the begin transaction. Completion is a transaction
guarded by seat index, revision, submission ID, and content digest. A newer
submission makes an older completion `STALE_RESOLUTION`; old bytes are discarded
and cannot overwrite the current head or snapshot. A recreated Durable Object
may resume a persisted `resolving` submission from its canonical stored input.

## Immutable snapshot and size

An accepted snapshot preserves each original entry's section, quantity,
zero-based input index, Scryfall ID, Oracle ID, and complete resolved `CardDef`.
Its digest is SHA-256 of one canonical ordered entries/definitions value and
does not depend on room, seat, deck ID, or submission ID, so identical decks
produce the same definition digest. The stored complete snapshot JSON must not
exceed 262,144 UTF-8 bytes; otherwise completion becomes
`needs-attention/SNAPSHOT_TOO_LARGE` with no accepted snapshot.

O4P-07A does not enforce the four-snapshot 1 MiB genesis envelope; O4P-07B
checks that boundary when it builds the Core root.

## Compatibility and security invariants

- The default v1 GET/submit/ready/start behaviors and response schemas remain
  byte-compatible for seats that do not invoke v2.
- v2 acceptance does not set ready and cannot start a Room through the v1 path.
- No public projection, log/fact, other-seat response, persisted lobby JSON, or
  generic error contains v2 entries, private issues, definitions, or secrets.
- Prototype/accessor/sparse/extra-field inputs fail closed before mutation.
- Resolver responses are treated as untrusted JSON and validated before mapping.
- No dependency, configuration, CR pin, fixed-catalog source, public UI, or
  production start/genesis import changes in this milestone.

## Done

Judge acceptance and ordinary tests prove exact validation, 76+ unique IDs,
duplicates, zero/multiple commanders, arbitrary totals, DFC mapping, not-found,
both identity mismatches, outage/retry, idempotency/conflict, concurrent same
submission, newer-submission stale completion, v1/v2 mutual invalidation,
snapshot size, SQLite CAS rollback, Durable Object recreation/resume, and
projection/log/capability secrecy. A fresh Luna/xhigh BROAD audit must report
BLOCKER/HIGH zero before the fingerprint-matched full check and release gates.
