# O4P-07C Fixed Runtime Removal & Production Release Contract

Date: 2026-08-23
Authority: user-ruling-2026-08-22:remove-fixed-online-catalog
Base SHA: `6899fd4a9e1adba71651d883174647970f7a5d59`
Risk: R3 / BROAD
Status: Judge-frozen implementation contract

## Goal

Complete O4P-07 by removing the shipped O4P-06A fixed catalog and raw-deck
bootstrap from every production runtime/import path. The served application and
Worker accept arbitrary Scryfall-resolved v2 submissions only, while the fixed
catalog and four decks remain available solely to regression tests.

O4P-07B Pages and Worker evidence already proves that the served client uses
v2. O4P-07C therefore owns the cached-client cutoff, production graph removal,
mechanical artifact proof, four isolated browser-context/cross-browser proof,
and terminal release.

## Legacy upgrade boundary

- Room creation and seat claim remain v1 because the current v2 client uses
  those credential-establishment messages. The lobby storage/projection and
  WebSocket/Core protocol versions are not renamed by this milestone.
- An exact legacy `online-forming-lobby-deck-submit-v1`,
  `online-forming-lobby-ready-v1`, `online-forming-lobby-start-v1`, or
  `online-forming-lobby-start-with-table-v1` request against an existing
  forming lobby returns HTTP 426 with exactly:

  ```json
  {
    "kind": "online-forming-lobby-upgrade-required-v1",
    "schemaVersion": 1,
    "requiredSchemaVersion": 2
  }
  ```

- The response is identical across seats and operations and contains no Room,
  participant, deck, card, issue, capability, or bearer data. It does not
  authenticate, mutate lobby/ready/snapshot/Room/security/history state, or
  call Scryfall.
- Malformed, extra-key, wrong-version, unknown, missing-Room, and post-start
  requests retain their existing closed generic failures. V2 submission,
  readiness, and start responses remain unchanged.
- The Worker must not retain a success handler or fallback for legacy deck,
  ready, or start. Cached clients must upgrade; no client-supplied CardDef or
  raw-text fallback is introduced.

## Fixed fixture and production graph boundary

The following bytes may remain only as regression fixtures:

- `src/online/bootstrap/catalog/catalogV1.ts`;
- `src/online/bootstrap/fourDeckBootstrapV1.ts`;
- `src/online/bootstrap/fixtures/o4p-06a-four-deck-card-catalog-v1.json`;
- the deterministic O4P-06A size/bootstrap tests that consume them.

Production code must satisfy all of the following:

1. `src/online/lobby/index.ts` has no static or dynamic import/re-export of the
   fixed bootstrap/catalog. Legacy fixed-start helpers, if retained, live under
   explicit fixture/test ownership and are imported directly only by tests.
2. `src/online/cloudflare/runtime.ts` imports/calls no legacy deck/ready/start
   mutator and no fixed-start helper. Its only accepted deck/ready/start path is
   v2; exact legacy operations take the 426 branch above.
3. The Cloudflare public barrel does not export fixed-start production helpers.
   The served public-app barrel does not export the legacy v1 controller; v1
   regression tests may import its module directly.
4. The transitive emitted-value import graphs rooted at `src/main.tsx` and
   `src/online/cloudflare/worker.ts` contain none of the fixed fixture paths,
   catalog JSON, `catalogV1`, `fourDeckBootstrapV1`,
   `bootstrapFourDeckGenesisV1`, or `O4P06A_CARD_CATALOG_V1`.
5. The built Pages JavaScript contains neither the fixed catalog kind
   `o4p-06a-four-deck-card-catalog-v1` nor the legacy submit-success/request
   strings. A Wrangler dry-run bundle of the exact release tree is checked for
   the same fixed-catalog markers and for absence of legacy submit/start success
   handlers before deployment.

A deterministic verifier is added to the canonical machine check after the
single Vite build. It traverses value imports from both production entries and
scans the built Pages assets. It accepts an explicit Worker dry-run bundle path
for release evidence, fails closed on unresolved relative imports, missing
assets, unreadable files, duplicate/ambiguous output, or any forbidden marker,
and never mutates product state.

## Preserved dynamic behavior

- Four accepted immutable snapshots remain the sole genesis input. No start
  path parses deck text, performs catalog lookup, or re-fetches Scryfall.
- Zero or multiple commanders, arbitrary totals, duplicate quantities, DFCs,
  identical decks in multiple seats, seat-scoped physical IDs, replay
  determinism, revision-zero empty journal, and the 1 MiB genesis envelope are
  unchanged.
- Owner-private structured issues remain private and actionable. Public
  projections, DOM outside the owner alert, logs, URLs, and other participants
  expose only the four public deck states.
- Solo import/library/start, CR pin, engine semantics, dependencies, Worker
  bindings/configuration, and existing size limits remain unchanged.
- Single-operator seat switching, EDH legality enforcement, and sideboards
  remain out of scope.

## Production acceptance and release

The exact audited release fingerprint must prove:

1. four catalog-external decks submit, accept, ready, start, reconnect, and
   replay through production; at least two seats use the identical deck without
   physical-ID collision;
2. zero/multiple commanders, a non-100 total, duplicate quantity, and a DFC are
   exercised across the four seats;
3. one owner-only known failure and retry expose no private detail to the other
   three seats or host/table views;
4. four storage-isolated contexts and the available real-browser matrix are
   exercised: Chrome normal, Chrome incognito, Firefox private/equivalent, and
   Safari private/equivalent;
5. 375x812, 812x375, and 1440x900 render without clipped controls or horizontal
   overflow and all four browser consoles report zero errors;
6. Pages HTML/assets, Wrangler dry-run Worker bundle, deployed Worker version,
   safe root probe, exact-head CI, and origin/main/clean-worktree evidence all
   correspond to the frozen release tree.

## Done

Fresh-context Luna/xhigh implementation and an independent Luna/xhigh R3/BROAD
cold audit report BLOCKER/HIGH zero. The same frozen product fingerprint passes
the targeted Judge acceptance, canonical full check, exact-head CI, Pages,
Worker, import/artifact scans, and production browser proof. Only then may both
ledger collections mark O4P-07C `shipped`, `goalPolicy.activeProgram` mark
O4P-07 `complete` with `nextDomainId: null`, and the O4P-07 program be called
complete.
