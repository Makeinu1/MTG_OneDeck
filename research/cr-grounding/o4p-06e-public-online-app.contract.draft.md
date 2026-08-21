# O4P-06E Public Online App contract

Date: 2026-08-21

Milestone: `O4P-06E`

Base SHA: `affb28de31ab562238b74199d0469a5bacef3d73`

Status: frozen Judge-owned candidate contract

Risk: R3 public network/UI integration and credential/privacy behavior

## Goal

Expose one honest public four-player path from the existing App: create or join
a private Room, choose an already saved deck, submit it, become ready, start,
connect through the shipped browser WebSocket client, and render the shipped
Personal Workbench, Table Display, and Guided/Manual Actions surfaces. The
default App remains the current offline Solo deck library/import/game path.

The integration composes the shipped Lobby, Bootstrap, Protocol, Projection,
Browser, Workbench, Table Display, Display Pairing, and Guided Actions public
contracts. It does not adapt Online projection into Solo `GameState`, mutate
authoritative state optimistically, or invent a second command/projection
schema.

## Public entry and Solo preservation

- With no Solo game active, App renders native buttons for `一人回し` and
  `4人オンライン`. Solo is the initial/default mode.
- No `fetch`, WebSocket construction, timer, capability generation, or Online
  storage access occurs until the user explicitly opens Online and performs a
  create/join action.
- Returning to Solo cancels lobby polling, closes both Online sockets, clears
  every volatile credential and Online snapshot, and restores the existing
  saved-deck/import/resume UI without resetting or translating Solo state.
- An active Solo game continues to render the existing `GameScreen`; O4P-06E
  does not insert Online UI into a running Solo game or change the Store.

## Fixed production endpoint

Production uses exactly
`https://mtg-onedeck-online.makeinu1.workers.dev`. Lobby calls use HTTPS and
the existing exact `/api/online/rooms` and
`/api/online/rooms/{roomId}/lobby` routes. WebSocket uses WSS and exactly
`/api/online/rooms/{roomId}/websocket`.

Room, participant, invite, seat, observer, and command capabilities never
appear in URL query, fragment, path other than the non-secret Room ID, browser
history, local/session storage, IndexedDB, cookies, logs, thrown text, error
messages, `data-*` values, React keys, analytics, or projection. Network errors
render fixed Japanese categories only; response bodies and thrown values are
never rendered.

## Lobby lifecycle

The public Online component receives only the already loaded saved-deck
options `{ id, name, deckText }`, an initial deck ID, and `onBackToSolo`.

Create:

1. generate a valid participant ID through Web Crypto;
2. POST the existing exact `online-forming-lobby-create-v1` body;
3. closed-validate the response before retaining any value;
4. show the Room ID plus exactly three one-time invite codes to the host, each
   behind a native copy button; and
5. retain seat/Table capabilities only in volatile component/controller
   memory. Seat and Table capabilities are never rendered. Invite codes are
   the sole credential intentionally visible to the creating host, disappear
   when leaving Online, and are copied only by explicit user gesture.

Join accepts separate Room ID and invite-code fields. Invite credentials are
never accepted from or written to the page URL. A successful claim clears the
invite field immediately and retains only the returned seat capability in
volatile memory.

Every Player chooses an already saved deck and explicitly submits its exact
saved deck ID/text. Empty/oversized/invalid values fail before network. Ready
is explicit and reversible before start. Lobby projection is refreshed after
each local transition and by one bounded two-second poll while forming/ready;
polling stops on leave, start, unmount, or terminal failure. Only the host sees
an enabled start control, and it is enabled only for a closed-validated
`ready` projection with all four occupied/deck-submitted/ready seats.

## Table-capable start extension

The shipped legacy `online-forming-lobby-start-v1` body and response remain
accepted unchanged. O4P-06E adds a separate exact body kind
`online-forming-lobby-start-with-table-v1` with schema version 1 and exactly:

```text
hostParticipantId
seatCapability
tableParticipantId
tableCapability
```

Create response additively returns a valid fresh Table participant ID and
observer capability to the creating host. They are not stored in the forming
lobby or included in its projection. The new start validates all four fields,
rejects collisions/fragments, proves host/seat authority and ready lifecycle,
and builds the same deterministic four-deck Core root plus exactly one
connected unseated `table` participant and exactly one matching observer
authorization before Room activation. It returns the existing generic started
response shape. Atomic initialization failure leaves the forming lobby
retryable and does not partially expose a Room.

The original four-deck bootstrap and original start function remain byte-
compatible in behavior. The Table-capable helper is additive and reuses the
shipped four-deck Core result plus public Room/Protocol constructors; it does
not copy card parsing, change Core bytes, change schema/version constants, or
permit spectator/roster mutation after start.

## Browser connection and authoritative UI

After start, or after a joined client observes `lifecycle: started`, create one
shipped browser client for the Player seat. The host also creates one client
for the Table observer. Credentials remain in closures/refs and are not part
of the published browser snapshot.

- Player projection is the only input to Personal Workbench and Guided/Manual
  Actions.
- Table projection is the only input to Table Display.
- Host pairing uses the shipped `OnlineDisplayPairing` and therefore renders
  only when both independently validated projections are the same Room and
  revision. Drift renders the existing generic unavailable state until the
  clients converge; inputs are never coerced or merged.
- Non-host Players render the real Personal Workbench and real Guided/Manual
  Actions without claiming a Table pairing they cannot authorize.
- Player actions are bound through shipped public binders. Refresh reconnects
  or requests a fresh projection without optimistic mutation. Accepted
  command envelopes enter only the shipped 64-entry browser outbox.
- Guided search/control/combat actions bind through the shipped guided binder.
  Face-down notes and life/commander corrections remain visibly labelled
  `手動記録（未送信）` and are never sent as accepted commands.
- UI status distinguishes connecting/updating/offline/failed in Japanese and
  never claims command success before ACK or authoritative projection.

## Accessibility and responsive acceptance

All operations are native buttons, inputs, and selects with visible labels,
keyboard focus, disabled state, and at least 44px compact targets. Copy,
opponent focus, refresh, ready, start, pass, concede, and guided/manual actions
have keyboard activation. No operation is drag-only, double-click-only,
hover-only, or pointer-only. Existing child right-click/keyboard alternatives
remain reachable and are not intercepted by the Online shell.

One stable browser session verifies 375x812 portrait, 812x375 landscape, and
1440x900 desktop. Mode choice, leave/return, lobby identity, four seat states,
deck/ready/start, connection status, Personal, Table (host), Guided/Manual,
errors, and invite copy controls remain reachable by ordinary scrolling.
There is no horizontal document overflow, fixed overlay obstruction, console
error, or console warning. Existing tokens/themes are reused; no remote visual
asset, audio, animation, or dependency is added.

Stable `data-testid` values identify the Online entry/root/back, create/join
fields and controls, Room and seat summaries, invite copy controls, deck,
ready/start/refresh controls, connection status, generic error, and the
existing child Online roots.

## Closed validation and failure behavior

Every HTTP response is treated as `unknown` and accepted only through
descriptor-safe, exact-key, dense-array, bounded validation. Accessors,
symbols, prototypes, sparse/oversized arrays, oversized UTF-8 bodies, unsafe
IDs, invalid lifecycle/seat relations, capability collisions/fragments, and
unexpected fields fail closed. Validation never calls caller `toJSON`,
accessors, or iteration hooks. At most four seats and three invites are
inspected. The UI retains no prior successful credential or projection after
an identity-changing failure.

Abort/unmount and late fetch/socket callbacks are epoch-fenced. Double submit
or stale responses cannot create two Rooms, reuse a mismatched command ID,
reapply a ready/start mutation, restore a cleared invite, or replace a newer
projection. No raw network value reaches user text.

## Write boundary

Judge-owned drafts, `review.*`, architecture registrations, ledgers, git, and
release evidence are outside the implementer boundary.

Allowed product/ordinary-test work:

- additive `src/online/publicApp/**`;
- additive Table-start helper under `src/online/lobby/**` and its public barrel;
- the minimum compatible create/start routing in
  `src/online/cloudflare/worker.ts` and `runtime.ts`, plus one minimum atomic
  Room-initialize/lobby-transition repository operation in
  `src/online/cloudflare/persistence.ts` and ordinary tests;
- additive `src/components/online/PublicOnlineApp.tsx` and
  `publicOnlineApp.css` plus ordinary tests;
- minimum composition changes in `src/App.tsx` and `src/App.css` plus ordinary
  non-review tests.

No Core, Projection, Protocol, Browser, Workbench, Table Display, Display
Pairing, Guided Actions, Store, Solo game component, dependency, package/lock,
Vite, workflow, Wrangler, version, cache, manifest, generated docs, shared
token, or deployment configuration semantic may change. Historical frozen
hashes/architecture allowlists, if invalidated by the exact permitted imports,
remain Judge-owned repair work after audit.

## Required evidence and defer

- Judge DOM review covers create/join/deck/ready/start, host Table pairing,
  non-host Player surface, truthful ACK/manual behavior, generic errors,
  teardown, Solo return, keyboard controls, and credential absence.
- Judge architecture review proves exact imports/write boundary, production
  endpoint/path closure, no credential persistence/log/URL, and Solo default.
- Ordinary tests cover hostile response validation, stale epochs, abort,
  double submission, table start atomicity, and component regressions.
- One stable real browser session covers the three viewports with zero
  console error/warning and zero horizontal overflow.
- Independent BROAD cold audit precedes one fingerprint-matched full check.

O4P-06E does not claim four simultaneous real production browsers, all four
real decks in production, reconnect/exit/replay/final-state comparison,
Cloudflare redeploy proof, or final program release. Those are exclusively
O4P-06F. Accounts, discovery, matchmaking, chat, spectators, URL invites,
offline Online persistence, multi-tab ownership, background sync, token
refresh, custom endpoints/domains, and capability rotation UI remain deferred.
