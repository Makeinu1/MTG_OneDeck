# O4P-07C production release evidence

Date: 2026-08-23
Milestone: O4P-07C
Risk: R3 / BROAD
Product release HEAD: `829f3f75aab4251aae0977e8ffd028bb08d4ac5c`

This record contains only sanitized release facts. Room IDs, invite codes,
seat/table capabilities, raw deck submissions, and private owner issues are not
recorded.

## Product and audit chain

- Fixed catalog/bootstrap modules remain byte-preserved regression fixtures but
  are absent from production lobby, public barrels, Worker/Page import graphs,
  and emitted production JavaScript.
- Valid legacy v1 deck/ready/start requests receive the exact secret-free HTTP
  426 upgrade response without state mutation or Scryfall resolution.
- Final semantic fingerprint:
  `250986253e6a3f6cde99ef25ef46df323676f22767ab8e7922df892e6059f587`.
- Product auditor `/root/o4p07c_final_luna_cold_audit` and the three bounded
  full-check-repair auditors returned BLOCKER/HIGH/MEDIUM/LOW `0/0/0/0`.
- Final product and repair tokens are recorded in
  `research/cr-grounding/archive/o4p-07c-cold-audit-record-2026-08-23.md`.

## Exact-head CI and Pages

Actions `32633685663` checked out the exact product HEAD and completed
successfully on 2026-08-23:

- build job `97180146510` passed the canonical full `npm run check`;
- Core 227 files / 2,093 tests;
- DOM 338 files / 2,283 passed + 1 skipped = 2,284 tests;
- machine verifiers, docs, lint, TypeScript, Vite build, O4P-07C production
  graph/artifact verifier, and exact diff ownership scan passed;
- deploy job `97181568676` published the same Pages artifact.

Served Pages evidence was rechecked after browser acceptance:

- `/MTG_OneDeck/`: HTTP 200;
- `assets/index-DfRb-Q8R.js`: HTTP 200, 1,020,680 bytes;
- `assets/index-DB7TO263.css`: HTTP 200, 207,206 bytes;
- served last-modified: `Sun, 23 Aug 2026 10:38:00 GMT`.

## Worker and dynamic four-seat acceptance

Wrangler 4.125.0 deployed the same product tree. Worker version
`bb60678b-13b3-4fc7-b80c-a81bd9f1b303` remains the newest deployment at 100%
allocation. The safe root probe returns the expected HTTP 404.

The production acceptance used five real Scryfall prints that are not members
of the fixed catalog and proved:

- four accepted seats, including two identical decks with distinct physical
  card IDs;
- zero and multiple commanders, non-100 totals, quantity three, and DFCs;
- an owner-only `CARD_NOT_FOUND` issue, corrected retry, and no issue detail in
  public/other-seat projections;
- exact legacy v1 HTTP 426 with no state mutation;
- ready/start into an active revision-zero Room;
- five open WebSockets, fresh-socket reconnect, stable projection/replay, and
  no capability leak.

## Browser and responsive evidence

The published Pages version was exercised in five storage-isolated browser
surfaces: Safari normal/private, Firefox normal/private, and Chrome
normal/incognito-equivalent. All rendered the dynamic Online controls; private
surfaces were independent from their normal browser stores.

Chrome responsive inspection covered 375x812, 812x375, and 1440x900. At every
size document scroll width equaled client width, the Online controls remained
reachable, and no clipping was observed. Chrome normal and incognito-equivalent
console errors and warnings were both zero. Safari and Firefox normal/private
rendered the same public Online form without a browser failure.

Together with the production API/WebSocket acceptance above, this closes the
four-seat, cross-browser, reconnect, replay, privacy, and responsive release
requirements without adding a single-operator seat-switch product feature.
