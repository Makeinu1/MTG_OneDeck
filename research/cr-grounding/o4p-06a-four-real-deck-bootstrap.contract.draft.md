# O4P-06A Four Real-Deck Bootstrap and Size Gate Contract

Date: 2026-08-16
Milestone: `O4P-06A`
Base SHA: `04dd0575388d3aa5a09f63ef6123f67b63933fe3`
Status: FROZEN
Risk lane: R3 protocol/state/genesis meaning; independent cold audit and release lane required

## Authority

This contract is authorized, in order, by:

1. `user-ruling-2026-08-15:playable-four-player-web-mvp`;
2. `research/cr-grounding/o4p-06-playable-four-player-roadmap.contract.draft.md`;
3. the explicitly authorized O4P-06A Judge task begun on 2026-08-16.

No model name is part of this contract. Judge, implementer, acceptance author,
and cold auditor are role boundaries.

## Goal

Accept exactly four structurally validated Commander deck inputs, bind them to
seats P1 through P4, and deterministically construct a complete revision-0
`ModeNeutralCoreRootV1` and active `OnlineProtocolStateV1`. The genesis must
preserve every input card and seat owner, serialize canonically, replay from an
empty command journal, and fail closed if the existing 1 MiB Core/state/request
envelope cannot be met.

## Source anchors and corrected facts

- Deck inputs are `Mydeck/Celes.txt`, `Mydeck/Gogo.txt`,
  `Mydeck/Kefka.txt`, and `Mydeck/Muldrotha.txt`. `parseDeckList` in
  `src/data/deckParser.ts` returns `ParsedDeck { entries, errors }`. The files
  contain 99/83/103/96 parsed entries and 100/100/104/100 expanded cards,
  respectively, with one quantity-one Commander each. O4P-06A validates
  syntax and Commander structure; it does not silently rewrite the 104-card
  Kefka fixture or add a deck-legality policy.
- The 17,491-card Scryfall list wrapper is at
  `research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json`.
  That raw directory is gitignored, so the raw corpus may be used to derive the
  committed O4P-06A catalog but may not be a runtime, CI, or review dependency.
- The V2 registry source is
  `src/engine/core/object/objectRegistryStateV2.ts` (there is no extra
  `object/` path segment). Room readiness is
  `setOnlineRoomPlayerReadyV1`, and `startOnlineRoomV1` receives the host
  participant ID as its second argument.
- Card snapshots and physical identity are defined in
  `src/engine/core/cardDefinition.ts`. Core composition follows
  `src/online/room/__tests__/testHelpers.ts`, using factory inputs without a
  `kind` field.
- Canonical Core serialization is owned by
  `src/engine/core/closure/canonicalV1.ts`; replay is owned by
  `replayCoreCommandsV1`; Cloudflare state serialization and the 1 MiB limit
  are owned by `src/online/cloudflare/codec.ts` and
  `src/online/cloudflare/types.ts`.

## Frozen input and validation contract

The additive bootstrap API accepts one plain readonly input containing
`roomId`, `serverBuildId`, and a dense `seats` array of exactly four entries.
Each seat contains `seatIndex`, `corePlayerId`, `participantId`,
`seatCapability`, `deckId`, and the unmodified `deckText`.

- Array position and `seatIndex` are exactly 0, 1, 2, 3; `corePlayerId` is
  exactly P1, P2, P3, P4 in that order. Seat 0 is the immutable Room host.
- `deckId` values and `deckText` values are pairwise distinct. The four
  acceptance inputs bind Celes/Gogo/Kefka/Muldrotha to P1/P2/P3/P4.
- Each `deckText` is parsed once by `parseDeckList`. Validation requires zero
  parser errors, at least one main-deck entry, positive safe-integer
  quantities, and exactly one Commander-section entry whose quantity is one.
- No input string, array, entry, or quantity is trimmed, sorted, deduplicated,
  merged, deleted, or mutated after parsing. In particular, repeated basic
  lands and all 104 Kefka cards are preserved.
- Invalid fields, duplicate decks, a bad Room/Build/capability identifier, a
  missing or ambiguous card, or any downstream Core/Room/Protocol validation
  failure produces no partial success value.

## Frozen card-definition resolution

The committed catalog is:

`src/online/bootstrap/fixtures/o4p-06a-four-deck-card-catalog-v1.json`

It is the only card-data dependency used by ordinary tests, Judge review, and
the shipped bootstrap. It contains exactly one entry for each of the 336
unique parsed lookup names across the four real deck files. Entries are
strictly ascending by raw JavaScript/code-unit `lookupName`, with no duplicate
lookup name. Each entry records `lookupName`, `resolution`, and `definition`.
`resolution` is exactly one of `pinned-exact`, `pinned-front-face`, or
`live-collection`.

Catalog derivation applies these routes in order:

1. `pinned-exact`: one case-sensitive exact match against a pinned-corpus
   top-level `name` (308 lookup names).
2. `pinned-front-face`: if and only if exact resolution found none, one exact
   match against `card_faces[0].name` on a pinned-corpus `transform`,
   `modal_dfc`, or `prepare` card (11 lookup names). This includes the unique
   `prepare` match from `Naktamun Lorespinner` to `Naktamun Lorespinner //
   Wheel of Fortune`. Combined names are not split for any other layout.
3. `live-collection`: if and only if both pinned routes found none, one bounded
   Scryfall collection request resolves exactly these 17 names:
   `Angelic Renewal`, `Blue Sun's Zenith`, `Bounty Agent`, `Capsize`, `Censor`,
   `Desecrated Tomb`, `Dispel`, `Emergence Zone`, `Ice Tunnel`, `Jeweled
   Amulet`, `Mage's Guile`, `Magosi, the Waterveil`, `Malakir Rebirth`,
   `Megrim`, `Scholar of the Lost Trove`, `Whispering Madness`, and `Zagoth
   Triome`.

The live acquisition budget is one semantically executed collection query. A
pre-query HTTP policy rejection is outside that budget only when all of these
conditions hold: HTTP 400, JSON `object: "error"`, `code: "bad_request"`,
`subcode: "generic_user_agent"`, and no `data` card array. After that exact
rejection, one and only one transport-correction POST is authorized. It keeps
the endpoint, method, Content-Type, and request body byte-identical (body
SHA-256 `289bccf5e5d21456d1e637d82c327e78828df62b6be43d0914c86c41c9e97831`)
and adds exactly this caller-set header:

`User-Agent: MTGOneDeckBootstrap/0.4p06a (four-deck catalog derivation; contact: local dev)`

The correction succeeds only with HTTP 200 and a JSON Scryfall list whose
`object` is `list`, dense `data` array has exactly 17 cards, `not_found` is
absent or empty, and `has_more` is absent or false. `total_cards` may be absent;
completeness is the conjunction of 17 dense `data` cards, no `not_found`, and
17 one-to-one mappings. A present `has_more: true` fails closed. Every requested
lookup must map one-to-one by exact top-level `name` or exact
`card_faces[0].name`; all 17 definitions must project and validate with no
duplicate Scryfall ID. Any other response or mapping consumes the budget and
fails closed with no further request, retry, endpoint, or fallback.

For `Malakir Rebirth`, the live lookup maps to face 0 of Scryfall card
`609d3ecf-f88d-4268-a8d3-4bf2bcf5df60`. Its fixture entry keeps
`lookupName: "Malakir Rebirth"` and `resolution: "live-collection"`, while its
definition keeps the full top-level name `Malakir Rebirth // Malakir Mire`,
layout `modal_dfc`, and both faces in Scryfall order. It uses the same full-card
projection as every pinned front-face entry; no single-face synthetic
definition is permitted.

Zero matches, multiple matches, a Scryfall `not_found`, a missing required
UUID/field, a lookup/face mismatch, or an invalid snapshot fails closed with a
path-specific issue. There is no fuzzy, substring, case-folded, localized,
newest-print, or runtime-network fallback.

The fixture wrapper contains exactly these fields and literals:

```json
{
  "kind": "o4p-06a-four-deck-card-catalog-v1",
  "schemaVersion": 1,
  "corpusManifest": {
    "api": "https://api.scryfall.com/cards/search",
    "query": "game:paper date>=2021-06-19",
    "unique": "cards",
    "includeExtras": false,
    "includeMultilingual": false,
    "includeVariations": false,
    "order": "name"
  },
  "corpusSavedCards": 17491,
  "entries": []
}
```

The shown empty `entries` is replaced by the 336 entries. `corpusManifest` is
exactly the `source` object from
`research/scryfall-rules/2026-06-19/manifest.json`, not a path or the full
manifest. Each `definition` has exactly the `CoreCardDefinitionSnapshotV1`
field set:

`source`, `name`, `layout`, `manaValue`, `colorIdentity`, `typeLine`,
`keywords`, `producedMana`, `tokenKind`, and `faces`.

`source` is exactly `{ kind: "scryfall", scryfallId, oracleId }` with lower-case
UUIDs; `tokenKind` is `null`. `manaValue` comes from `cmc`. Color arrays are
unique in W/U/B/R/G/C canonical order, keywords are unique code-unit sorted,
and faces stay in Scryfall face order. A card with `card_faces` uses each face;
otherwise it yields one top-level face. Every face has exactly `name`,
`manaCost`, `typeLine`, `oracleText`, `power`, `toughness`, `loyalty`, and
`defense`; absent nullable values become `null`, absent Oracle text becomes the
empty string, and a face missing `type_line` uses the top-level `type_line`.
Definitions used in the Core registry are keyed by `scryfallId`; duplicate use
of one definition is shared only as immutable definition data.

## Frozen genesis

- Physical card IDs are deterministic and seat-namespaced:
  `P<seat>-card-<ordinal>`, with a four-digit, one-based ordinal. Ordinal 0001
  is the Commander; main cards follow in parsed entry order with each
  quantity expanded contiguously. Object IDs use incarnation zero via the
  existing Core card-object ID rule.
- Every physical card's `ownerPlayerId`, object, definition, and destination
  is derived from the same seat/entry/copy tuple. The Commander is in shared
  `command`; every main card is in its owner's library. Library array index 0
  is the top, so input order is preserved exactly. Every initial card object's
  `baseControllerPlayerId` is null. Hands, graveyards, battlefield, stack, and
  exile start empty. No shuffle or opening draw occurs.
- Each player starts at life 40 with poison/energy/experience/mulligans/turn
  counters zero, an empty six-color mana pool, and
  `maximumHandSizeOverride: "none"`. Turn order and the complete active
  lifecycle roster are P1, P2, P3, P4; P1 is active.
- Every card object has the shipped default runtime: face 0, face-up,
  untapped, unflipped, not phased out, no counters or marked damage, and no
  attachment. The stack bundle contains the registry, complete object-runtime
  record, empty stack announcements, and empty pending triggers. Control,
  visibility, search sessions, play permissions, and decision authorities are
  empty.
- Genesis lifecycle is fixed to turn 1, `positionSequence: 0`, beginning phase
  untap step, with `turn-based-action-required`, action
  `untap-step-actions`, player P1.
- The Core root uses `CORE_CLOSURE_VERSION_VECTOR_V1`, accepted command count
  zero, four Commander identities in seat order, zero cast ledgers, empty
  Commander damage/provenance, and `combatContext: null`.
- Room construction uses `createOnlineRoomV1`, joins seats 1 through 3 in seat
  order, readies P1 through P4 with `setOnlineRoomPlayerReadyV1`, starts with
  the host participant ID, and activates with the Core root. Activation must
  prove the Room seat roster equals the Core roster and all four Core players
  are active with null exit causes.
- `createOnlineProtocolStateV1` receives the validated `serverBuildId`, active
  Room, Core root, and no observers. The resulting revision and Core accepted
  command count are zero and receipts are empty. Current contract versions
  remain schema 1, `mtg-cr-2026-06-19`, and engine/state/event/protocol/
  projection version 1. Build IDs retain the shipped
  `^[A-Za-z0-9._-]{1,64}$` rule.

No clock, randomness, environment state, storage, DOM, or network participates
in bootstrap execution.

## Canonical, replay, identity, and failure invariants

- Two fresh builds from JSON-equivalent inputs produce byte-identical
  `serializeModeNeutralCoreRootV1` output, the same
  `coreCanonicalDigestFromValueV1` digest, and byte-identical validated
  Protocol serialization. Inputs remain unchanged and successful output is a
  fresh deeply frozen graph.
- Replayable genesis means `createCoreReplayPackageV1(coreRoot, [])` followed
  by `replayCoreCommandsV1` succeeds with an empty event transcript and a
  final root/digest exactly equal to genesis. Genesis is not represented as a
  new gameplay command.
- Every physical card and object ID occurs exactly once. An owned zone may
  contain only cards whose physical owner is that zone's player. Each command
  zone Commander owner, root Commander owner, and originating seat agree.
  Every physical card's `definitionId` is the catalog result for its own input
  lookup name. Shared immutable definitions do not constitute identity
  crossing.
- Public bootstrap returns a deep-frozen discriminated result. Failure is
  `{ ok: false, issues }`; every issue is exactly `{ code, path, message }`.
  Issues are complete, deduplicated, and code-unit sorted by path, code, then
  message. Failure returns no Core root, Protocol state, replay package, or
  measurement value and never exposes capability fragments.

## Frozen 1 MiB size gate

The limit is exactly `ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1` (1,048,576). Byte
length is always `new TextEncoder().encode(serialized).length`; string length
is not evidence. All three artifacts must be at or below the limit:

1. `canonical-core-root`:
   `serializeModeNeutralCoreRootV1(coreRoot)`;
2. `online-protocol-state`:
   `serializeOnlineCloudflareProtocolStateV1(protocolState)`, with successful
   canonical deserialize round trip;
3. `cloudflare-initialize-envelope`: `JSON.stringify` of exactly
   `{ kind: "online-cloudflare-room-initialize-v1", schemaVersion:
   ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1, state: protocolState }`, the body
   accepted by the existing Room `PUT` path.

Success contains the frozen measurements in the fixed artifact order above.
An oversize artifact yields, respectively,
`CORE_ROOT_SIZE_LIMIT_EXCEEDED`, `PROTOCOL_STATE_SIZE_LIMIT_EXCEEDED`, or
`INITIALIZE_ENVELOPE_SIZE_LIMIT_EXCEEDED`, at path
`/measurements/<artifact-id>`. The message contains only measured bytes and
`limitBytes=1048576`. All oversize issues are returned together. Any one keeps
O4P-06A non-shippable and Judge-gated until a bounded alternative is
implemented and verified inside O4P-06A; no artifact may be truncated or
compressed implicitly.

## Write boundary and constraints

Implementation is additive and limited to new files under
`src/online/bootstrap/**`, including the catalog fixture and ordinary tests.
No existing source file or barrel is required or permitted to change. The
Judge later owns
`src/online/bootstrap/__tests__/review.o4p-06a-four-real-deck-bootstrap.test.ts`.

No dependency, package, workflow, version, CR pin, parser, existing Core,
Room, Protocol, Projection, Cloudflare runtime, Store, Solo, React/CSS,
governance, docs, ledger, or deployment change is authorized. TypeScript is
strict; `any` is forbidden. Code, comments, identifiers, and errors are
English.

## Done when

1. The four tracked real-deck files resolve through the committed 336-entry
   catalog and produce a valid, active, revision-0 four-seat genesis.
2. Same input produces the same canonical strings/digests and empty-journal
   replay equivalence; caller input is unchanged and output deeply frozen.
3. Expanded card counts are exactly 100/100/104/100, all four Commanders are in
   command, every main card stays in decklist order, and all seat/owner/
   definition/object invariants hold.
4. Exact UTF-8 byte evidence for all three production-size artifacts is at or
   below 1,048,576, and over-limit red probes fail with the frozen issue shape.
5. Ordinary targeted tests pass; Judge-authored review uses all four real
   decks; independent R3 cold audit reports BLOCKER/HIGH zero; the exact audited
   fingerprint passes one full `npm run check` before release.

## Explicit DEFER / non-goals

Browser lobby, deck submission over HTTP, transport, WebSocket, outbox,
recovery, UI, React integration, new gameplay commands, shuffling, opening
hands, Commander deck-legality enforcement, arbitrary live-deck catalog
coverage, production deploy, Cloudflare migration, GitHub publication, and
O4P-06B through O4P-06F are deferred.
