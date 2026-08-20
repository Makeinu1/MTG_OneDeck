# O4P-06A Acceptance Brief

Milestone: `O4P-06A`
Base SHA: `04dd0575388d3aa5a09f63ef6123f67b63933fe3`
Contract: `research/cr-grounding/o4p-06a-four-real-deck-bootstrap.contract.draft.md`
Status: FROZEN Judge-owned acceptance

## Acceptance scenarios

1. **O4P-06A-AC-01 — Catalog completeness and provenance.** The committed
   catalog wrapper is kind `o4p-06a-four-deck-card-catalog-v1`, schema version
   1, has the exact frozen `corpusManifest` source object and
   `corpusSavedCards: 17491`, and contains exactly 336 unique code-unit-sorted
   lookup names: 308 `pinned-exact`, 11 `pinned-front-face`, and 17
   `live-collection`. Every front-face match is unique and has layout
   `transform`, `modal_dfc`, or `prepare`; the `prepare` case is exactly
   `Naktamun Lorespinner`. Every live entry maps one-to-one by exact top-level
   or face-0 name. The accepted collection evidence may omit `has_more` and
   `total_cards`, but has exactly 17 dense `data` entries, empty `not_found`,
   and 17 one-to-one mappings. `Malakir Rebirth` retains the combined
   `Malakir Rebirth // Malakir Mire` modal-DFC definition and both ordered
   faces. Every projected definition has the exact frozen field set, validates
   as a Core definition keyed by its Scryfall UUID, and no test reads the
   gitignored raw corpus or contacts the network.
2. **O4P-06A-AC-02 — Four real inputs validate without rewriting.** The exact
   tracked Celes/Gogo/Kefka/Muldrotha files parse with zero errors, one
   quantity-one Commander each, 99/83/103/96 entries, and 100/100/104/100
   expanded cards. Input bytes and parsed values remain unchanged.
3. **O4P-06A-AC-03 — Resolution fails closed.** Missing, ambiguous, duplicate,
   malformed, incorrectly routed, or invalid-UUID fixture entries; unresolved
   deck names; duplicate deck IDs/text; parser errors; invalid quantities; and
   zero/multiple Commanders produce deterministic sorted issues and no partial
   value. No fuzzy/case/localized/network fallback occurs.
4. **O4P-06A-AC-04 — Deterministic identity and zones.** P1 through P4 receive
   deterministic seat-namespaced physical/object IDs. Each Commander is in
   shared command; each main card is in its owner's library with index 0 as
   top and exact expanded decklist order. Every card/object occurs exactly
   once and no physical owner, definition provenance, or zone crosses seats.
5. **O4P-06A-AC-05 — Complete Core genesis.** Players have the frozen EDH
   defaults; runtime, stack announcements, pending triggers, authority slices,
   Commander ledgers/damage/provenance, and combat context match the contract.
   Existing validators accept the complete root.
6. **O4P-06A-AC-06 — Exact lifecycle.** Genesis is turn 1,
   `positionSequence: 0`, beginning/untap, with P1's
   `turn-based-action-required: untap-step-actions` window. Wrong player,
   position, action, or sequence fails existing lifecycle validation.
7. **O4P-06A-AC-07 — Room and Protocol revision zero.** Room construction,
   join, ready, start, and activation use the shipped operations in seat
   order. The active Room roster equals the four-active-player Core roster.
   Protocol state has revision zero, accepted command count zero, no observers,
   and no receipts, and validates with the current version vector and Build ID.
8. **O4P-06A-AC-08 — Canonical determinism.** Two fresh builds from
   JSON-equivalent inputs have byte-identical canonical Core and Protocol
   serializations and identical Core digests. Success output is fresh and
   deeply frozen; caller input is unchanged.
9. **O4P-06A-AC-09 — Replayable genesis.** An empty-journal Core replay package
   validates and `replayCoreCommandsV1` returns the genesis root/digest and an
   empty event transcript. No synthetic genesis gameplay command is added.
10. **O4P-06A-AC-10 — Production-size evidence.** One successful four-real-deck
    build reports all three measurements in the frozen order and each is
    `<= 1_048_576` UTF-8 bytes. Protocol state round-trips through the existing
    Cloudflare codec, and the initialize envelope is the exact existing PUT
    request body.
11. **O4P-06A-AC-11 — Size failure is closed.** Deterministic boundary probes
    prove equality to the limit is accepted and every value above it returns
    the matching frozen issue code/path/message, with all oversize artifacts
    reported together and no partial success or capability fragment.
12. **O4P-06A-AC-12 — Boundary preservation.** No existing source/barrel,
    `review.*`, parser, Core/Room/Protocol/Cloudflare semantics, version,
    dependency, docs/governance/ledger, UI, workflow, git, or deployment file
    changes. No lobby, transport, gameplay command, shuffle, opening hand, or
    production behavior is claimed.

## Implementer iteration commands

The implementer runs ordinary tests only while iterating:

```sh
npx vitest run --project dom src/online/bootstrap/__tests__/cardCatalogV1.test.ts src/online/bootstrap/__tests__/fourDeckBootstrapV1.test.ts src/online/bootstrap/__tests__/sizeGateV1.test.ts
npx eslint src/online/bootstrap
npx tsc -b
git diff --check
```

The Judge later authors and owns:

`src/online/bootstrap/__tests__/review.o4p-06a-four-real-deck-bootstrap.test.ts`

The implementer must not create, edit, or use that review as self-acceptance.
The `dom` project name is intentional: the repository's frozen Vitest project
map assigns every non-`src/engine/**` test, including additive online Node-only
tests, to the `dom` collection lane. The earlier `core` spelling collected no
files and was corrected by the Judge without changing product meaning.
After implementation freeze, the Judge runs the targeted ordinary tests plus
the review, freezes the fingerprint, commissions an independent R3 cold audit,
closes findings, and only then runs the fingerprint-matched release lane.

## Exact size evidence format

The successful ordinary and Judge evidence must expose this exact JSON shape
(decimal byte values are measured, never estimated):

```json
{
  "kind": "o4p-06a-size-evidence-v1",
  "limitBytes": 1048576,
  "measurement": "TextEncoder-UTF-8",
  "artifacts": [
    {
      "id": "canonical-core-root",
      "bytes": 0,
      "withinLimit": true
    },
    {
      "id": "online-protocol-state",
      "bytes": 0,
      "withinLimit": true
    },
    {
      "id": "cloudflare-initialize-envelope",
      "bytes": 0,
      "withinLimit": true
    }
  ]
}
```

Each `0` is replaced by the actual non-negative safe-integer byte count. The
artifact order, IDs, limit, measurement label, and boolean relation are exact.
Judge review must print or snapshot this compact object for the four-real-deck
case; synthetic, single-deck, ignored-raw-corpus, or estimated evidence cannot
satisfy O4P-06A.
