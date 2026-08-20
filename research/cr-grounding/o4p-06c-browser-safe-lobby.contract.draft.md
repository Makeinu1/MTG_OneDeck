# O4P-06C Browser-Safe Lobby & Invite API — Frozen Contract

Date: 2026-08-21
Milestone: `O4P-06C`
Base SHA: `c33bc609449df906e3521f8d5568b2a1cfd3621e`
Risk: `R3` (public HTTP authority, bearer capability, persisted forming state)

## Goal

Add the browser-safe transition from an empty room name to the already-shipped
O4P-06A four-real-deck genesis. Four players must claim distinct seats, submit
only their own deck, set readiness, and let the immutable host start. The server
derives and validates the complete revision-0 `OnlineProtocolStateV1`; no public
browser request may import a caller-supplied `coreRoot`, `room`, protocol state,
seat capability set, or unrestricted initialization envelope.

## Public routes

- `POST /api/online/rooms` creates a forming lobby. The closed JSON body is
  `{ kind: "online-forming-lobby-create-v1", schemaVersion: 1,
  participantId }`.
- `GET /api/online/rooms/{roomId}/lobby` returns only a public lobby projection.
- `POST /api/online/rooms/{roomId}/lobby` accepts exactly one closed action:
  `online-forming-lobby-seat-claim-v1`,
  `online-forming-lobby-deck-submit-v1`,
  `online-forming-lobby-ready-v1`, or
  `online-forming-lobby-start-v1`.
- Existing active-room `GET`, commands, capabilities, and WebSocket routes remain
  backward-compatible. Browser-origin Worker
  `PUT /api/online/rooms/{roomId}` is closed with `405`; the origin-less release
  harness and Durable Object may retain their compatibility import, but the
  O4P-06C browser flow never calls it.
- Unknown paths/methods and malformed, oversized, accessor-backed, sparse, or
  non-plain inputs fail closed before mutation or namespace lookup where the
  Worker can decide them.

## Origin policy

The exact allowlist is frozen as:

1. `https://makeinu1.github.io`
2. `http://localhost:5173`
3. `http://127.0.0.1:5173`

An `Origin` header must be an exact member: no prefix/suffix matching, wildcard,
`null`, credentials, alternate port, or case folding. A browser-origin request
outside the allowlist returns generic `403` before Durable Object lookup.
Origin-less non-browser requests remain compatible, but receive no CORS grant.
Allowed responses echo only the exact origin and include `Vary: Origin`; they do
not emit `Access-Control-Allow-Credentials`. `OPTIONS` is handled at the Worker,
per known route/method, with `204`, exact origin, and only `content-type` as an
allowed request header. A disallowed method/header/path returns a generic error
without Durable Object lookup. WebSocket upgrades also enforce the same exact
Origin allowlist when `Origin` is present.

## Capabilities and identifiers

- The server creates the non-secret room ID and all bearer material with
  `crypto.getRandomValues`. Bearers contain at least 256 random bits and use a
  canonical base64url spelling. Randomness is injectable/stubbable only at the
  local runtime boundary for deterministic ordinary tests.
- Seat 0 is claimed by the creator and returns its seat capability once. The
  create response returns three one-time, seat-scoped invite capabilities for
  seats 1–3. Claim consumes exactly one invite and returns that seat's distinct
  seat capability once. Reuse, cross-seat substitution, or guessed material is
  rejected without mutation.
- Bearers never appear in URLs, query strings, public lobby projections, generic
  errors, request facts, persisted command journals, or loggable status. The
  create/claim success response is the only public disclosure point for newly
  issued bearer material.
- Room, participant, and deck identifiers use the existing closed application-ID
  grammar and unsafe-key rejection. Capability fragments of length eight or
  greater are forbidden in every non-capability identifier or submitted deck
  metadata field.

## Forming state machine

`src/online/lobby/index.ts` exports the schema constant, types, validator,
projection, and pure immutable operations named:

- `createOnlineFormingLobbyV1`
- `claimOnlineFormingLobbySeatV1`
- `submitOnlineFormingLobbyDeckV1`
- `setOnlineFormingLobbySeatReadyV1`
- `startOnlineFormingLobbyV1`
- `projectOnlineFormingLobbyV1`

The caller supplies already-generated server values to the pure create operation;
the browser never does. The state has exactly four ordered seats mapped to
`P1`–`P4`, immutable host/room/build identity, unique seat and invite bearers,
optional participant/deck submission, and readiness. Only `forming`, `ready`,
and `started` are valid lobby lifecycles.

- Claim: only an unclaimed seat with its unused invite may be claimed.
- Deck submit: only the connected claimant with its seat capability may replace
  that seat's `deckId`/`deckText`; replacement resets its ready flag.
- Ready true: requires a claimed seat and submitted deck. The lobby is `ready`
  iff all four seats are claimed, have decks, and are ready; any valid reversal
  returns it to `forming`.
- Start: only the immutable connected host with its seat capability may start a
  `ready` lobby. It calls the shipped `bootstrapFourDeckGenesisV1` using exactly
  the four persisted submissions and server-generated identifiers/bearers.
  Bootstrap/card/size/replay failure leaves the forming candidate unchanged.
  The pure operation returns `{ lobby, genesis }`, where `lobby.lifecycle` is
  `started` and `genesis` is the successful O4P-06A bootstrap result.
  Success persists revision 0 through the existing Cloudflare repository and
  exposes only safe active-room status.
- A repeated successful action is either an explicitly idempotent safe read or a
  stable rejection; it must not rotate/re-disclose capability material.

## Persistence, limits, and recovery

The Durable Object persists one versioned lobby record in SQLite before active
room initialization. Deck text is private server state and is bounded to
262,144 UTF-8 bytes per seat; existing 1,048,576-byte HTTP body enforcement
remains. Lobby reads validate closed canonical state before use. A crash between
active repository initialization and lobby finalization recovers by treating the
existing canonical revision-0 protocol state as authoritative and never permits
a second genesis with different bytes.

All rejected operations are write-free. Creation conflict, claim race, stale
invite, wrong seat capability, deck overflow, readiness violation, non-host
start, invalid deck/catalog entry, bootstrap size failure, and initialization
conflict return generic stable HTTP errors without bearer or deck leakage.

## Manual boundary

No accounts, cookies, public room discovery/listing, matchmaking, chat, display
names, arbitrary deck catalogs, client-supplied complete state, capability in a
URL/log, browser WebSocket recovery, or public App UI is added here. Browser
WebSocket recovery is O4P-06D; public App integration is O4P-06E.
