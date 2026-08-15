# O4P-06 Playable Four-Player Web MVP Roadmap Contract

Date: 2026-08-15<br>
Authority: user-ruling-2026-08-15<br>
Base SHA: `69559e13716e9d0767d8189714d8c14fb630db46`<br>
Status: Judge-owned roadmap registration; product behavior remains unimplemented

## Goal

Turn the shipped headless four-seat runtime into a public Web experience in
which four people can each load a real Commander deck, join the same room,
perform the ordinary tabletop actions needed to play, recover from connection
loss, and complete one game from four browser sessions.

This registration corrects a product-claim gap. O4P-05 proved the existing
test-only/headless release gates and production Worker, but it did not wire a
browser lobby, browser WebSocket client, real four-deck room bootstrap, or the
Online UI into the public `App.tsx`. No O4P-06 entry may cite an earlier
headless result as evidence that those browser behaviors already exist.

## Frozen serial sequence

```text
O4P-05D (shipped)
  -> O4P-06A Four Real-Deck Bootstrap & Size Gate
  -> O4P-06B Playable Table Command Surface
  -> O4P-06C Browser-Safe Lobby & Invite API
  -> O4P-06D Browser WebSocket, Outbox & Recovery
  -> O4P-06E Public App Four-Player Integration
  -> O4P-06F Four-Browser Production Acceptance & Release
```

Every O4P-06 entry starts as `pending`, exists exactly once in both ledger
collections, and depends directly on its predecessor. Only one parent may be
active at a time. Registering the program does not freeze any milestone's
implementation contract and does not authorize a dependency, protocol, CR,
ruleset, secret, or production-deployment change.

## Milestone boundaries

### O4P-06A — Four Real-Deck Bootstrap & Size Gate

Accept four validated Commander deck inputs and deterministically construct a
complete revision-0 `ModeNeutralCoreRootV1` / `OnlineProtocolStateV1`. Prove
canonical serialization, replayable genesis, seat/deck identity, and safe
failure when the existing 1 MiB request/state envelope cannot be met.

Done when four distinct real-deck fixtures produce the same canonical initial
state from the same inputs, no card identity crosses seats, and production-size
measurements pass. A failed measurement is fail-closed: O4P-06A remains
non-shippable and `judge-gated` until a bounded alternative is implemented and
verified inside O4P-06A. Lobby, transport, UI, new gameplay commands, and
deployment are deferred.

### O4P-06B — Playable Table Command Surface

Add the typed, authorized, replayable commands needed for ordinary tabletop
operation: draw, generic zone movement, tap/untap, mana-pool adjustment,
counters, token creation/removal, and turn/phase progression, plus only the
minimum correction paths required by the accepted four-player scenario.

Done when each command has deterministic success/reject behavior, projection
and authority rules, undo/replay evidence where applicable, and four-seat
tests. This is not a promise of arbitrary Oracle automation; unsupported
compound effects remain honestly guided/manual.

### O4P-06C — Browser-Safe Lobby & Invite API

Add a forming-room lifecycle with seat claim, per-seat deck submission,
ready/start, capability-scoped invite material, and an exact-origin browser
HTTP policy including `OPTIONS`. Room initialization becomes a server-checked
transition and must not trust one browser to submit an unrestricted complete
room state.

Done when browser preflight, allowed/disallowed origins, malformed payloads,
seat races, capability leakage, start idempotency, and size limits are covered.
Accounts, public room discovery, global matchmaking, chat, and secrets in URLs
or logs remain out of scope.

### O4P-06D — Browser WebSocket, Outbox & Recovery

Implement the browser transport state machine for hello/projection, command
ACK, bounded outbox, resync, reconnect, stale-response rejection, and snapshot
recovery against the shipped Worker protocol.

Done when disconnect/reconnect and duplicate/out-of-order delivery cannot
silently lose an accepted action or optimistically mutate authoritative state,
and credentials do not leak to storage, logs, or projection. Protocol changes
must remain versioned and backward-fail-closed.

### O4P-06E — Public App Four-Player Integration

Expose room create, invite, join, deck submission, ready/start, Personal
Workbench, Table Display, and Guided/Manual Actions from the public app. The
four-player entry may compose the shipped Online components but must not bypass
their projection and capability contracts.

Done when the public app supports the full join-to-play path, preserves Solo
offline behavior, has keyboard/right-click alternatives, and passes one stable
browser session at 375x812, 812x375, and 1440x900 with console errors zero and
no private-card leakage.

### O4P-06F — Four-Browser Production Acceptance & Release

Run the complete scenario with four actual browser contexts, four real decks,
the production Worker, reconnect/resync, ordinary table actions, one player
exit, and final-state/replay comparison. Release only the exact audited
fingerprint through full local check, exact-head Actions, Pages, Cloudflare,
served assets, and production smoke evidence.

Done when BLOCKER/HIGH are zero and every advertised step has executable
final-state evidence. A 24-hour soak, account-wide abuse controls, public
matchmaking, chat, spectators, and custom-domain access remain separate future
decisions.

## Reference-project policy

The following repositories are architecture and UX references only. They do
not authorize copying code, adopting a dependency, replacing the shipped
Worker/Durable Object design, or importing a license obligation.

- Cockatrice Webatrice: split create/join/deck/ready/start flows and a React
  WebSocket client — <https://github.com/Cockatrice/Webatrice>
- PartyKit: reconnecting socket, buffering, and recovery test ideas —
  <https://github.com/cloudflare/partykit>
- boardgame.io: lobby create/list/join credentials and failure contracts —
  <https://github.com/boardgameio/boardgame.io>
- Tehes poker: shared-table plus private-device invitation UX only —
  <https://github.com/Tehes/poker>

Any later implementation must inspect the then-current license and use only
ideas compatible with this repository's existing architecture and authority
model.

## Governance and release boundary

- O4P-06A through F are parents, not repair waves. A downstream parent cannot
  begin before its predecessor is shipped.
- Each parent requires its own contract, independent acceptance author,
  implementer, independent cold auditor, targeted evidence, one final
  fingerprint-matched `npm run check`, and release proof.
- Production source, dependencies, API versions, CR pins, Cloudflare deploys,
  and GitHub publication are outside this roadmap-registration candidate.
- Registering O4P-06 changes selection policy and therefore requires a BROAD
  independent cold audit before the registration can be released.
