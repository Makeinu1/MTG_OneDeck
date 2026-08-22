# O4P-07B Arbitrary-Deck Public UI and Dynamic Genesis Contract

Date: 2026-08-22
Authority: user-ruling-2026-08-22-remove-fixed-online-catalog
Base SHA: `a650c5edc09afc03b59e3da9f55950485eec140d`
Risk: R3 / BROAD
Status: frozen for implementation

## Goal and boundary

Move the served Online app from legacy raw-text deck submission to the accepted
O4P-07A v2 snapshot path. Every locally saved deck and a newly imported card
list can be selected, submitted, corrected, readied, and started without a
fixed-catalog lookup. Four accepted immutable Room snapshots are the only card
authority used by the new start path.

O4P-07B does not reject cached v1 clients or delete the O4P-06A catalog and
fixtures. Those legacy runtime/import removals and production four-browser
release claims belong to O4P-07C. Single-operator seat switching, EDH legality,
sideboards, and client-authoritative definitions remain out of scope.

## Served deck and import surface

The served `PublicOnlineApp` receives the full ordered saved-deck entries, not
only raw deck text. A selectable deck contains a safe application `id`, display
`name`, and one or more ordered entries with local display `CardDef`, positive
safe-integer quantity, and `commander | main` section. The client constructs the
v2 wire list only from `section`, `quantity`, `card.scryfallId`, and
`card.oracleId`; it never transmits names, Oracle text, images, complete
definitions, deck text, or a Core root.

An explicit `新しいカードリストを読み込む` action opens the existing
Scryfall-backed importer without destroying an already joined Room or exposing
Room credentials. A successfully resolved list is saved through the existing
IndexedDB deck library, immediately appears selected in Online, and is not
submitted or readied without the user's separate actions. Cancel, parse error,
unresolved card, storage failure, and unmount leave the current Room and prior
selection safe. Sideboard input remains rejected by the importer.

## Closed public v2 client

The served client validates and polls
`GET /api/online/rooms/<roomId>/lobby?schemaVersion=2`. The closed projection is
the shipped `online-forming-lobby-projection-v2`: four seats expose only index,
Core player ID, nullable participant ID, `deckState`, and `ready`. The client
does not impose unique deck IDs because v2 projections intentionally omit them
and identical decks across seats are valid.

Deck submission uses the shipped `online-forming-lobby-deck-submit-v2` request
with a fresh unpredictable application-safe `submissionId` for every explicit
submit/retry. An identical in-flight double activation is synchronously
suppressed. The client accepts only the exact v2 result bound to its Room and
submission; response drift, oversized/non-JSON bodies, secret fragments, and
stale request epochs fail closed.

Two new closed mutations complete the public v2 forming flow:

```ts
type OnlineReadyV2 = {
  kind: 'online-forming-lobby-ready-v2'
  schemaVersion: 2
  participantId: string
  seatCapability: string
  ready: boolean
}

type OnlineStartWithTableV2 = {
  kind: 'online-forming-lobby-start-with-table-v2'
  schemaVersion: 2
  hostParticipantId: string
  seatCapability: string
  tableParticipantId: string
  tableCapability: string
}
```

The ready response contains only kind, schema version, Room ID, and the safe v2
projection. The start response is the exact
`online-forming-lobby-start-result-v2` with Room ID, outcome
`started | needs-attention`, issue `null | ROOM_GENESIS_TOO_LARGE`, and either
the existing safe revision-zero Room status or `null`. Only the deterministic
size rejection uses the known issue. Authorization, corrupt snapshot, hostile
shape, protocol, persistence, or unknown runtime faults retain the generic
error path.

Room creation and invite claim may keep their v1 credential-bearing response
envelopes in this milestone. They are used only to establish the participant,
seat/table capabilities, and initial empty Room; every subsequent public
projection/deck/ready/start decision in the served app uses v2.

## Owner-actionable errors and truthful status

The submitting seat maps a returned `entryIndex` to its local ordered entry and
shows the local `printedName ?? face printedName ?? name` in `《》`. It provides
specific Japanese correction/retry guidance for `EMPTY_LIST`,
`INVALID_SECTION`, `INVALID_QUANTITY`, `INVALID_CARD_ID`, `CARD_NOT_FOUND`,
`IDENTITY_MISMATCH`, `SCRYFALL_UNAVAILABLE`, `SUBMISSION_CONFLICT`,
`STALE_RESOLUTION`, and `SNAPSHOT_TOO_LARGE`. A retryable result exposes an
explicit retry action that generates a fresh submission ID. Known issue text
is owner-local and is never copied into a public projection, URL, log, table
surface, other participant response, or persisted client credential bundle.

Other participants and the host see only `デッキ未提出`, `デッキ確認中`,
`デッキ確認済み`, or `デッキ要修正` per seat. Ready is disabled for the
local seat unless its current v2 state is `accepted`. Host start is enabled
only when all four seats are occupied, `accepted`, and ready.

Before a WebSocket starts, the summary says `ロビー待機中` or
`デッキ確認中`; it does not call this state offline. After start only, the
connection labels are `接続中`, `オンライン`, or `再接続中`. The generic
`オンライン操作を完了できませんでした。` remains only for unknown
transport/protocol/runtime failures.

## V2 readiness relation

The persisted lobby ready bit may represent a v2-only ready seat while legacy
`deckId`/`deckText` stay null, but only the repository may create that state and
only after authenticating the seat and proving the current head is `accepted`
with a matching immutable snapshot/digest. Every v2 load, projection, ready
transition, and start revalidates the lobby/head/history/snapshot relation.

The v2 projected ready value is true only when both the stored bit and current
accepted snapshot relation are true. V2 projected lifecycle is `ready` only
when all four seats are occupied, accepted, and ready; `started` is emitted
only after atomic Room initialization. A replacement v2 submit and every v1
deck replacement clear ready before external work. Corrupt or mixed v1/v2
state cannot appear ready or start through either path.

Legacy v1 wire projections preserve their old invariant. A v2-only seat is
shown there as deck-not-submitted/not-ready, and a v2-only ready Room is shown
as forming. This compatibility view must not disclose the v2 deck ID, digest,
entries, definitions, or issue details.

## Dynamic Room genesis

The v2 start path loads exactly four current accepted heads and their four
seat-scoped snapshots directly from SQLite. It does not read legacy deck text,
parse card names, call Scryfall, or import/lookup the O4P-06A catalog. Snapshot
JSON and digest are revalidated before construction. The initialization
transaction CAS-verifies the exact lobby bytes plus each seat index,
participant, submission revision, submission ID, content digest, and snapshot
digest so a replacement cannot race into the started Room.

Each resolved `CardDef` is canonically converted to the existing
`CoreCardDefinitionSnapshotV1`: Scryfall/Oracle source IDs, English name,
layout, mana value, W/U/B/R/G color identity, type line, deterministic
keywords, W/U/B/R/G/C produced mana, token kind, and all ordered faces with
nullable Core face fields. Display-only localized/image/rank fields are not
Core authority. Repeated print IDs share one identical Core definition; a
same-ID/different-definition collision fails closed.

Entries expand in seat order, then input index, then copy index. Every copy in
`commander` is a commander in the command zone; every copy in `main` enters
that player's library. Zero commanders, multiple commander entries,
commander quantities above one, arbitrary total quantities, duplicate entries,
and DFC faces are preserved. Physical card IDs are deterministic and
seat-scoped as `P<seat>-card-<six-digit expanded ordinal>`; identical decks in
different seats therefore never collide.

Construction performs safe-integer arithmetic and a bounded preflight before
expansion so hostile huge quantities cannot exhaust CPU/memory. The existing
1,048,576-byte exact canonical Core/protocol size gate remains authoritative;
any count that cannot fit the bounded construction or exact envelope yields
`ROOM_GENESIS_TOO_LARGE` without mutating lobby, snapshots, Room, security,
checkpoint, or replay state.

The resulting Core root, active Room, protocol state, empty-journal replay,
canonical digest, table observer authorization, and revision-zero status retain
the existing O4P-06 invariants. Once started, the Core definitions and snapshot
digests in that Room are immutable and later Scryfall changes have no effect.

## Security and compatibility invariants

- Capability/bearer values never enter deck options, submissions, snapshot
  definitions/digests, UI errors, public DOM, logs/facts, Core definitions, or
  replay payloads.
- Client parsing is closed over ordinary dense data and never evaluates
  accessors/prototypes from a response or saved deck.
- V2 submission/ready/start is same-seat/host authorized and all mutations are
  rejected after start.
- Served Online imports and calls the v2 controller. Existing v1 endpoints may
  remain for cached clients only until O4P-07C and must not be used as fallback
  after a v2 error.
- No dependency, configuration, CR pin, engine semantic, solo import/start, or
  single-operator control change is authorized.

## Done

Executable Judge acceptance proves the complete public v2 flow with four
catalog-external decks, identical decks in multiple seats, zero/multiple
commanders, non-100 totals, quantities, DFCs, resubmission/ready clearing,
owner-only errors/retry, atomic dynamic start, reconnect, and empty-journal
replay. The served UI is verified at 375x812, 812x375, and 1440x900 with zero
console errors. A fresh Luna/xhigh R3/BROAD audit must report BLOCKER/HIGH zero
before fingerprint-matched full check and release gates. O4P-07B does not claim
the fixed runtime path has been removed; that claim waits for O4P-07C.
