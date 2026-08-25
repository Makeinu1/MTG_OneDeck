# O4P-09B Shared Intent / Application contract

Date: 2026-08-25
Base SHA: `ce06a17b123cb6684090b48f9350df085e98ec54`
Risk: R3 / STANDARD shared application and online authority boundary

## Goal

Define one versioned `GameIntentV1` and one shared application entrypoint for
Mode-Neutral Core commands. Local executes the intent in-browser through the
shipped in-memory variable protocol; Remote submits the same normalized intent
to the shipped server-authoritative variable protocol. Both paths expose the
same command acknowledgement and the same audience-safe v3 projection.

O4P-09B lands the application seam only. It does not claim that the legacy
`GameState`-backed `GameScreen` is already driven by Mode-Neutral Core.

## Frozen intent

`GameIntentV1` is an exact, immutable record with these fields only:

- `kind: 'game-intent-v1'`
- `schemaVersion: 1`
- `commandId: OnlineProtocolCommandIdV1`
- `baseRevision: OnlineProtocolRevisionV1`
- `command: CoreCommandV1`

Room, participant, capability, transport, projection, and mutable application
state are adapter authority, never intent payload. Validation is deterministic
and fail closed: reject accessors, symbols, non-enumerable or surplus keys,
invalid IDs/revisions, invalid Core commands, and a command sequence other than
`baseRevision + 1`. A rejected input must not invoke either adapter.

The intent wraps the existing closed Core algebra. O4P-09B does not add a
higher-level UI semantic union or a second command compiler.

## Shared application path

1. `applyGameIntentV1(adapter, input)` is the public application entrypoint.
   It validates and freezes the intent, constructs one exact
   `OnlineCommandEnvelopeV1` from the adapter's private authority context, and
   invokes the selected adapter once.
2. The application result is a closed immutable attempt:
   `ok: true` carries one `game-application-exchange-v1` containing `receipt`
   (`OnlineCommandAckV1 | OnlineCommandRejectV1`) and
   `projection` (`OnlineVariableParticipantProjectionV3`); `ok: false` carries
   bounded public issue codes, paths, and generic messages.
3. A successful application attempt may contain a protocol rejection receipt.
   `ok` means the application boundary completed and returned validated
   authority output; it does not rewrite a rejected command as accepted.
4. Receipt identity, protocol version, room, participant, command ID,
   base/current/accepted revision relations, issue shape, and projection
   identity/revision must be validated before Remote output is exposed.
5. Neither attempt variant exposes capability, protocol request digests,
   internal receipt storage, `coreRoot`, events, private errors, or raw transport
   exceptions.

## Local adapter

- `createLocalGameApplicationAdapterV1` owns a validated
  `OnlineVariableProtocolStateV2` in browser memory and a player authority
  context.
- For each validated envelope it invokes
  `handleOnlineVariableCommandEnvelopeV2` exactly once, commits only that
  returned protocol state, and derives the player's projection only with
  `projectOnlineVariableProtocolV3`.
- It must not call `applyCoreCommandV1` directly, mutate the root optimistically,
  introduce another reducer, or expose its private protocol state.
- Duplicate command IDs, mismatched reuse, stale revisions, authorization,
  sequence, Core rejection, receipts, and revision advance retain the shipped
  protocol semantics.

## Remote adapter

- `createRemoteGameApplicationAdapterV1` accepts the same private authority and
  one injected asynchronous submit port. The port receives the exact envelope
  created by the shared application entrypoint.
- The adapter never applies Core or projection locally and never performs an
  optimistic state mutation. It resolves only after a validated receipt and a
  matching final participant projection are available.
- Invalid or mismatched authority output and transport failure fail closed with
  bounded public issues; raw error content is not returned.
- The existing `online-command-envelope-v1` wire remains unchanged. Any later
  wire change requires a new version and must reject unsupported versions.

## Parity oracle

For the same initial `OnlineVariableProtocolStateV2`, player authority, and
`GameIntentV1`, a Local adapter and a Remote adapter backed by the shipped
server handler/projector must return structurally equal application exchanges.
This includes accepted status, revisions, duplicate behavior, and the exact
audience-safe v3 projection. Both projections must validate and contain no
capability, request digest, internal receipt collection, or Core root.

Parity is defined on the Mode-Neutral application seam. It is not raw equality
between legacy Solo `GameState` and an online participant projection.

## Required product boundary

Implementation is additive under `src/online/application/**` with ordinary
tests beside it. It reuses Core, Protocol, and Projection public exports.
O4P-09B does not alter Core command meaning, protocol handlers, projection
constructors, Browser transport, Cloudflare runtime, Room lifecycle, the
O4P-09A interaction port, `GameScreen`, controller, Zustand store, or visual
components.

## Explicit deferrals

- Binding `GameScreenInteractionPort` to this application seam.
- Compiling legacy/UI semantic actions into `CoreCommandV1`.
- `GameState` to `ModeNeutralCoreRootV1` conversion.
- Pregame, hidden-information operations, tabletop algebra expansion, assisted
  priority/HOLD, shared undo, full-match E2E, and spectator presentation.
- Any claim that Remote play is production-complete before O4P-09C-J.

## Verification boundary

- Judge review proves the exact intent, shared entrypoint, Local/Remote
  separation, fail-closed validation, accepted/duplicate parity, projection
  equality, secret-safe results, frozen path boundary, and absence of a second
  Core executor or player screen.
- Ordinary tests cover rejection, stale/reuse behavior, hostile descriptors,
  transport failure redaction, and immutable results.
- Focused application/protocol/projection tests, affected ESLint, TypeScript,
  docs checks, forbidden-file classification, and diff checks pass before
  freeze.
- A fresh-context R3/STANDARD cold audit must return BLOCKER/HIGH zero before
  the single release full check and exact-head release gates.
