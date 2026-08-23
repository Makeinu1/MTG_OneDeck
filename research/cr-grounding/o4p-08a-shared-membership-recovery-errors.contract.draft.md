# O4P-08A Shared Membership, Recovery, Moderation, and Errors Contract

Date: 2026-08-23
Authority: user-ruling-2026-08-23 + O4P-08 roadmap
Base SHA: `2c338a69f41eb693696db12c086e706423679aa6`
Risk: R3 / BROAD
Status: frozen for implementation

## Goal

Add one shared Room admission credential in front of the shipped four-seat
lobby, exchange it for a unique seat credential, persist same-browser recovery,
support explicit pre-start leave and host kick, and return actionable
secret-free failure codes. Preserve the existing four-seat Room, v2 deck
snapshot, genesis, protocol, projection, and public page layout in this parent.

## Shared admission model

The existing three per-seat `inviteCapability` values remain internal Room
material and are never returned by the v3 create/recover/rotate responses. A new
SQLite singleton `online_lobby_admission` owns:

```ts
type OnlineLobbyAdmissionV3 = Readonly<{
  kind: 'online-lobby-admission-v3';
  schemaVersion: 3;
  roomId: string;
  currentCapability: string;
  generation: number;
  open: boolean;
  retiredCapabilities: readonly string[]; // newest first, max 4
}>;
```

Create v3 generates the ordinary four unique seat capabilities, three hidden
seat invites, Table credentials, and one shared admission capability. The
client-visible invite code is the exact closed encoding
`v3.<base64url UTF-8 Room ID>.<shared capability>`. Parsing rejects padding,
non-canonical base64url, invalid Room IDs/capabilities, extra segments, getters,
and secret fragments outside the capability field. A share link uses
`#online-invite=<percent-encoded code>`; the client reads and scrubs it with
`history.replaceState` before any network request. No query or request path
contains the shared capability.

Distinct participant IDs may exchange the current shared capability until the
lobby is full, started, closed, or rotated. Exchange picks the lowest empty seat
and consumes only that seat's hidden invite, returning its unique
`seatCapability`. Shared admission never authorizes deck, ready, start, recover,
kick, leave, command, WebSocket, or projection-private operations.

Rotation is host-only, retires the prior shared capability, increments a safe
generation, opens admission, and returns the new invite code. Close is host-only
and sets `open=false`. A retired capability yields `INVITE_ROTATED`; an unknown
one yields `INVITE_INVALID`. Neither error returns either capability.

## Wire protocol

All new mutation bodies are closed exact records with `schemaVersion: 3`.

- Create: `online-forming-lobby-create-v3` with `participantId`.
- Claim: `online-forming-lobby-shared-claim-v3` with `participantId` and
  `admissionCapability` on the existing Room lobby route.
- Recover: `online-forming-lobby-recover-v3` with `participantId` and
  `seatCapability`.
- Rotate/close: `online-forming-lobby-admission-rotate-v3` or
  `online-forming-lobby-admission-close-v3`, each with host participant and seat
  capability.
- Kick: `online-forming-lobby-kick-v3` with host participant/capability and
  `targetParticipantId`.
- Leave: `online-forming-lobby-leave-v3` with participant and seat capability.

Success responses are closed, versioned, and include the safe v2 lobby
projection. Create/recover for the host also returns Table credentials and the
current invite code; non-host responses never do. Claim returns only the newly
issued participant/seat identity plus projection. Rotate returns the new invite
code. Close/kick/leave return projection, except host close may return a closed
terminal acknowledgement.

Host explicit leave before start closes and deletes the forming lobby,
admission, and every v2 deck row. Non-host leave frees and rekeys its seat.
Kick is host-only, cannot target the host, and is valid only in `forming` or
`ready`. It removes the target participant, clears legacy and v2 deck/head/
history/snapshot/ready rows, clears lobby ready, and atomically replaces the
seat and hidden-invite capabilities. Old participant/seat credentials are
recorded in a newest-first revoked set bounded to 64 rows per Room and recover
as `CREDENTIAL_KICKED`. Started
rooms reject kick/leave/rotate/close; active player exit remains the shipped
command/concession boundary.

## Structured failure envelope

Every recognized v3 request returns either a valid success or:

```ts
type OnlinePublicErrorV3 = Readonly<{
  kind: 'online-public-error-v3';
  schemaVersion: 3;
  code:
    | 'ROOM_NOT_FOUND' | 'ROOM_EXPIRED'
    | 'INVITE_INVALID' | 'INVITE_ROTATED' | 'ADMISSION_CLOSED'
    | 'ROOM_FULL' | 'PARTICIPANT_RECOVERABLE'
    | 'CREDENTIAL_REJECTED' | 'CREDENTIAL_KICKED'
    | 'HOST_REQUIRED' | 'INVALID_LIFECYCLE'
    | 'DECK_REQUIRED' | 'DECK_RESOLVING' | 'DECK_NEEDS_ATTENTION'
    | 'PLAYERS_NOT_READY' | 'CLIENT_UPGRADE_REQUIRED'
    | 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE';
  retryable: boolean;
  correlationId: string;
}>;
```

Malformed/unrecognized/non-v3 requests keep the shipped generic fail-closed
response. Correlation IDs are random safe application IDs and never derive from
Room, participant, deck, or capability bytes. The client maps each known code
to Japanese cause, next action, and retryability; unknown or hostile envelopes
fall back to the existing generic message. Network abort/offline/timeout is
classified client-side and never fabricated as a server result.

## Durable browser recovery

Add a versioned recovery adapter with key `mtg-onedeck:online-recovery-v1`:

```ts
type PublicOnlineRecoveryRecordV1 = Readonly<{
  kind: 'public-online-recovery-v1';
  schemaVersion: 1;
  roomId: string;
  participantId: string;
  seatCapability: string;
  isHost: boolean;
  tableParticipantId: string | null;
  tableCapability: string | null;
}>;
```

The adapter uses `localStorage` behind an injectable storage interface, exact
validation, canonical JSON, and exception-safe load/save/clear. It stores no
shared invite. Create/claim/recover save only after authoritative success.
Recover validates the seat before adopting projection or opening WebSockets.
Leave, host close, kicked/rejected credential, missing/expired Room, and terminal
Room clear it. Transient offline/service failure retains it. Plain controller
disconnect closes transport but does not clear it.

Private-window persistence after all private windows close is browser-owned and
not promised. No recovery content enters URL, projection, error, logs, facts,
Core state, deck storage, or analytics.

## Compatibility and defers

- Existing v1 create/claim and v2 deck/ready/start remain accepted for the
  currently served client until O4P-08B switches the public journey.
- Four-seat schema/genesis and 40-life behavior remain byte-compatible where
  not touched by membership persistence.
- O4P-08A adds no public layout, display names, two-player roster/life choice,
  account identity, permanent ban, matchmaking, host transfer, or post-start
  moderation.
