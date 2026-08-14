# O4P-04C Display Pairing contract

Date: 2026-08-14

Milestone: `O4P-04C`

Base SHA: `4b2f4ac534c489ce92d2f3dfce4774679c597502`

Status: frozen judge-owned candidate contract

Risk: R3 public Online client binding plus R2 UI/private-information behavior

## Goal and diagnosis

O4P-04A and O4P-04B render independently validated Player and Table
projections. They intentionally do not prove that two supplied projections are
the same Room snapshot, provide seat-relative opponent focus, or bind the
Personal Workbench intents to the shipped Online protocol. A wrapper that only
places both components on one page would therefore allow cross-Room or
cross-revision drift to look paired, while constructing protocol frames inside
React would mix bearer authority with display state.

O4P-04C adds one pure Display Pairing boundary and one adaptive paired surface.
The pure boundary validates both projections, proves their shared public facts
agree, derives seat-relative opponent focus, and translates the three shipped
Workbench intents into existing protocol frames. It does not change any
Projection, Room, protocol, Core, or Cloudflare semantic.

## Paired input and fail-closed boundary

`buildOnlineDisplayPairingViewV1(unknown)` receives exactly:

```text
personalProjection: unknown
tableProjection:    unknown
focusedPlayerId:    string | null
```

It must validate both projections through the shipped public validator and
also require that the Personal Workbench and Table Display public builders
accept their respective input. A valid pair satisfies all of the following:

1. the first projection is a connected pending Player with one Core player and
   seat; the second is a connected, unseated Table participant;
2. protocol version, Room ID, revision, Room lifecycle, host, participant list,
   seats, turn order, turn position, and public Player facts are equal;
3. every per-player hand/library/graveyard count and every shared-zone public
   value are equal, while audience-specific private entries need not be equal;
4. the own Core player occurs exactly once and the opponent list is the other
   three players in projected turn order with their Table-approved seat,
   presence, outcome, lifecycle, life, poison, and active-turn facts;
5. `focusedPlayerId` is null or exactly one opponent ID. Self, unknown,
   duplicated, malformed, or exited opponents are not silently substituted.

Any failure throws only `OnlineDisplayPairingErrorV1` with the fixed message
`Display pairing is unavailable`. The React surface renders only the generic
Japanese text `表示を同期できません`. Neither path may expose input values,
Room/participant/object IDs, capability material, validation issues, paths,
thrown text, or stacks. Both validators and the pairing builder must be
trap-safe and must not mutate either caller value.

## Paired view and opponent focus

The builder returns a fresh deeply frozen exact value:

```text
kind:          "online-display-pairing-view-v1"
schemaVersion: 1
revision
ownPlayerId
ownSeatIndex
opponents: readonly {
  playerId, seatIndex, isFocused, isActive,
  presence, outcome, status, life, poison
}[]
focusedOpponent: the matching opponent object or null
```

The model copies only Table-approved public facts. It stores neither source
projection, Room ID, participant ID, bearer capability, card/zone data, nor an
alias into caller-owned arrays or objects. It preserves projected turn order;
it does not sort, trim, deduplicate, merge, default a focus, retain previous
state, mutate inputs, or use time/RNG/network/storage/DOM/React/logging.

Opponent focus is controlled presentation state. Selecting a focus emits a
fresh deeply frozen exact action
`{ kind: "focus-opponent", playerId, revision }`. It does not mutate either
projection, send a Core command, change control/visibility, or grant access to
private zones. The own Player is never offered as an opponent. Exited opponents
remain visible in seat context but are disabled as new focus targets; an
already focused opponent that becomes exited invalidates the pair until the
caller clears focus.

## Session-to-protocol frame binding

`bindPersonalWorkbenchActionV1(unknown)` is a pure deterministic boundary. Its
input is the exact record:

```text
session: {
  protocolVersion, roomId, participantId, participantCapability,
  clientBuildId, corePlayerId, personalProjection: unknown
}
action: PersonalWorkbenchActionV1
commandId: string | null
```

The session identity must form a validator-accepted `OnlineClientHelloV1`.
`personalProjection` must independently validate as the same connected pending
Player/Room/participant/Core-player/revision through the shipped Player
Workbench boundary. The action actor/revision must match that current validated
Player projection.
The function returns one fresh deeply frozen existing protocol frame:

- `request-refresh` with `commandId: null` becomes an
  `OnlineProjectionRequestV1` using the action's `knownRevision` and
  `decisionContext: null`;
- `priority-pass` with a non-null command ID becomes an
  `OnlineCommandEnvelopeV1` containing one validator-accepted Core command at
  `sequence = baseRevision + 1`, actor = decision maker = the bound Player,
  decision key = command ID, and payload `priority-pass` for that Player;
- `concede` becomes the same envelope shape with payload `player-exit`, the
  bound Player, and cause `concession`.

The constructed request/envelope must pass the shipped public validator before
return. Refresh rejects a non-null command ID; command actions reject null,
invalid, incompatible, or bearer-colliding IDs. A command ID is bearer-
colliding when it contains any eight-or-more-character fragment of the bound
capability. The binder does not invent randomness, time, acknowledgement,
legality, success, retry, outbox settlement, or optimistic state. Bearer
capability appears only in the required outbound protocol field;
it is never included in the pairing view, focus action, error, UI, DOM,
attribute, logging, or test snapshot.

## React paired surface

`OnlineDisplayPairing` has exactly these props:

```text
personalProjection: unknown
tableProjection: unknown
interactionState: "ready" | "updating" | "offline"
focusedPlayerId: string | null
onFocus(action: OnlineOpponentFocusActionV1): void
onAction(action: PersonalWorkbenchActionV1): void
```

It rebuilds the pair on every render, including when the same input references
were mutated by a hostile caller. On success it renders one Japanese pairing
status with the synchronized revision, three seat-relative opponent controls,
an optional public focused-opponent summary, the real `PersonalWorkbench`, and
the real read-only `TableDisplay`. It passes the original audience projection
only to its corresponding already-validated component. It never swaps,
combines, or broadens their inputs.

Focus controls are native buttons with visible focus and `aria-pressed`; no
operation is drag-, double-click-, hover-, or pointer-only. Status meaning does
not rely on color. The component claims only snapshot synchronization, never a
priority holder, command legality, acknowledgement, or network health.

One adaptive tree serves 375x812, 812x375, and 1440x900. Both child surfaces,
pairing state, focus controls, and focused summary remain reachable by ordinary
scrolling with no fixed overlay. It uses existing CSS variables, Japanese UI
text, stable `data-testid` values, and no remote asset, animation, audio, or new
dependency.

## Module and write boundary

Production work is additive under `src/online/displayPairing/**`,
`src/components/online/OnlineDisplayPairing.tsx`, and
`src/components/online/onlineDisplayPairing.css`. A dev-only fixture lives under
`src/dev/displayPairing/**`, with an HTML entry under
`research/design/display-pairing/**`.

The pure module may import only the public barrels for Projection, Personal
Workbench, Table Display, protocol, and Core. It must not import Room internals,
Cloudflare, headless, Store, Solo UI, React, DOM, browser APIs, or private
implementation files. The React surface may import React, the three public UI
components/types, and the Display Pairing barrel/CSS. It performs no fetch,
WebSocket, persistence, timer, or capability handling.

Judge-owned architecture registrations may add exactly the new
`displayPairing` Online root and the exact component-to-public-barrel import.
No existing production source, root Online barrel, App/main entry, dependency,
Vite config, version, cache schema, Projection/Room/protocol/Core/Cloudflare
source, or existing A/B component contract changes.

## Required evidence

- Judge DOM review proves synchronized-pair acceptance, mismatch fail-close,
  seat/focus behavior, audience isolation, same-reference revalidation,
  trap-safe generic errors, and exact frozen focus actions.
- Judge pure review proves exact refresh/pass/concede protocol frames, public
  validator acceptance, deterministic sequences, identity/revision mismatch
  rejection, input non-mutation, deep freeze, and bearer non-disclosure.
- Judge architecture review proves additive imports/writes, exact architecture
  registrations, dev-only fixture reachability, and no root integration.
- One stable browser session verifies 375x812, 812x375, and 1440x900 with zero
  console errors and both surfaces reachable.
- The frozen R3 candidate receives one independent BROAD cold audit before one
  fingerprint-matched release `npm run check`.

## Explicit DEFER / non-goals

No endpoint selection, WebSocket/fetch execution, Room create/join form,
capability acquisition/rotation/storage, localStorage/IndexedDB, reconnect
timer, outbox replay/settlement, acknowledgement UI, optimistic update,
cross-device focus message, Projection/Room/protocol/Core semantic change,
Solo migration, App/root integration, guided control/search/face-down/combat,
manual correction, DnD, audio, motion, Scryfall fetch, image reconstruction, or
release-ruleset update. O4P-04C binds existing intents to existing transport
frames and proves paired snapshot semantics; O4P-04D owns guided/manual action
families, and O4P-05B-C own executable release/recovery/security composition.
