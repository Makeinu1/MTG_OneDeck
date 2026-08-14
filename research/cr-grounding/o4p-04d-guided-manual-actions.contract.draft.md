# O4P-04D Guided/Manual Actions contract

Date: 2026-08-14

Milestone: `O4P-04D`

Base SHA: `1f6a465b859ba64c9961c6fcdae80087e33b9882`

Status: frozen judge-owned candidate contract

Risk: R3 public Online command binding plus R2 UI/private-information behavior

## Goal and diagnosis

O4P-04A through O4P-04C provide a paired Personal/Table display and bind only
refresh, priority-pass, and concede. The Player projection also contains safe
public objects and authorized SearchSessions, but it intentionally omits the
Core root, combat context, control slice, canonical state digest, physical
Commander IDs, full priority state, and legality results. A UI that infers any
of those omitted facts would create a second rules engine and could falsely
claim an unsupported compound action was automated.

O4P-04D adds one Player-only Guided/Manual Actions surface. It separates
server-revalidated command attempts from local manual worksheets. It never
changes Projection semantics, exposes a Core root, or labels an attempted or
manual action as accepted. This milestone is the final slice of O4P-04.

## Input and fail-closed view

`buildOnlineGuidedActionsViewV1(unknown)` receives one hostile Player
projection and must call `validateOnlineParticipantProjectionV1` before reading
semantic fields. The projection must pass the O4P-04A Player/seat/pending
relations: role `player`, non-null Core player, one connected matching Player
participant and seat, pending outcome, active or finished Room, and one active
projected own Player. Every failure is one generic Japanese unavailable state
without caller values, IDs, issue paths/messages, thrown text, or stack.

The returned fresh deeply frozen `OnlineGuidedActionsViewV1` contains only
copied projected facts:

- revision, own Player ID, Room lifecycle, and current turn position;
- active player summaries with public life and poison;
- authorized SearchSessions whose rules actor and selector are both the own
  Player, preserving session and candidate order;
- visible battlefield/stack objects as control candidates and active Players
  as possible gaining controllers;
- public concealed battlefield/stack/exile objects as generic face-down manual
  items with only object handle, zone, tapped/phased/counter/damage facts;
- visible own-controlled battlefield objects as attacker/blocker candidates,
  visible battlefield objects as attacked-object candidates, and other active
  Players as defending-player candidates;
- visible Commander object handles and public Player totals for a manual-only
  correction worksheet.

The exact public view shape is:

```text
kind: "online-guided-actions-view-v1"
schemaVersion: 1
revision
actorPlayerId
roomLifecycle
turn: { activePlayerId, turnNumber, phase, step }
players: readonly {
  playerId, isSelf, isActive, life, poison
}[]
searchSessions: readonly {
  sessionId, zone, minimum, maximum, mayFailToFind,
  revealFound, shuffleAfter,
  candidates: readonly { objectId, label }[]
}[]
controlCandidates: readonly {
  objectId, label, controllerPlayerId
}[]
faceDownItems: readonly {
  objectId, zone: "battlefield" | "stack" | "exile",
  label: "《裏向きのカード》", tapped, phasedOut, counters, markedDamage
}[]
combat: {
  ownObjects: readonly { objectId, label, controllerPlayerId }[],
  attackedObjects: readonly { objectId, label, controllerPlayerId }[],
  defendingPlayers: readonly { playerId, isSelf, isActive, life, poison }[]
}
corrections: {
  players: readonly { playerId, isSelf, isActive, life, poison }[],
  commanders: readonly { objectId, label }[]
}
```

`minimum`/`maximum` come from either projected criteria member and
`mayFailToFind` is the projected qualified value or `false` for quantity.
`ownObjects` contains visible own-controlled battlefield objects;
`attackedObjects` contains all visible battlefield objects; defending Players
exclude self. `commanders` contains visible projected Commander objects from
battlefield, exile, graveyard, stack, or command in their projection order.

Visible labels use only the projected definition name wrapped in `《》`.
Synthetic stack objects receive fixed generic Japanese kind labels. Concealed
objects are always `《裏向きのカード》`; no owner, controller, definition,
face, Oracle text, physical ID, source, or prior identity is reconstructed.
Hidden-card values never receive a handle or UI action.

The model preserves every projection order. It does not sort, trim,
deduplicate, merge, default, mutate, or retain a previous projection. It has no
ambient time, RNG, network, storage, DOM, React, locale, or logging dependency.

## Closed action algebra

The surface emits fresh deeply frozen `OnlineGuidedActionV1` values. The closed
server-revalidated command-attempt members are:

```text
complete-search:
  actorPlayerId, baseRevision, sessionId, selectedObjectIds

apply-control:
  actorPlayerId, baseRevision, effectKey, targetObjectId,
  gainingControllerPlayerId, sourceObjectId, duration: { kind: "manual" }

declare-attacker:
  actorPlayerId, baseRevision, attackerObjectId, defendingPlayerId

declare-blocker:
  actorPlayerId, baseRevision, blockerObjectId, attackedObjectId,
  defendingPlayerId
```

The exact local manual-only members are:

```text
note-face-down:
  actorPlayerId, baseRevision, objectId, note

request-life-correction:
  actorPlayerId, baseRevision, playerId, replacementLifeTotal, reason

note-commander-damage-correction:
  actorPlayerId, baseRevision, commanderObjectId,
  defendingPlayerId, replacementDamageTotal, reason
```

The creator validates an exact ordinary root, current projection membership,
own actor/revision, safe integers, non-empty untrimmed text, unique ordered
search selection, and the closed literal fields. It copies and freezes output
without mutating input. Search selection must be a subset of the exact
projected candidates, but the client does not implement the full search
criteria. Control/combat candidates are visibility and shape candidates only,
not legality claims. Buttons and confirmations say `サーバーへ確認する`.

Manual-only actions are local worksheet records. The UI labels them
`手動記録（未送信）`, does not call them corrections applied, and does not
clear them as success. Text is preserved exactly after rejecting whitespace-
only input. It is never placed in DOM attributes or error messages.

The public creator is exactly
`createOnlineGuidedActionV1({ projection, action }): OnlineGuidedActionV1`.
Its hostile input is one exact record with only `projection` and `action`; the
closed action record is validated against the freshly rebuilt view. There is no
unchecked action constructor or unversioned alias.

## Protocol binding

`bindOnlineGuidedCommandActionV1(unknown)` accepts exactly:

```text
session: OnlineDisplayPairingSessionV1
action:  OnlineGuidedActionV1
commandId: OnlineProtocolCommandIdV1
```

The binder validates the session and current Player projection using the
shipped O4P-04C identity/revision rules. It rejects manual-only actions,
missing/invalid IDs, command IDs containing a configured bearer or bearer
fragment, actor/revision/session drift, candidate drift, and every malformed or
trap-bearing root with one fixed secret-free error.

The four guided members become one `OnlineCommandEnvelopeV1` at
`sequence = baseRevision + 1`, with the bound Player as actor. Search uses the
exact `{ kind: "search-session", searchSessionId }` decision context and the
bound Player as decision maker. Control and combat use
`{ kind: "decision", decisionKey: commandId }`. Payloads are exactly the
shipped `search-complete`, `control-effect-apply`, `combat-attack-add`, and
`combat-block-add` Core payloads. The binder calls the shipped Core command and
protocol-envelope validators before return.

Binding proves only a validator-accepted request shape. The server remains the
sole authority for revision, decision authority, search criteria, object
controllability, combat step/candidate legality, and acknowledgement. Rejection
is not converted to a local success.

Neither correction worksheet can be bound because Projection omits the
required `expectedBeforeStateDigest`, and Commander projection omits the
physical card ID. Face-down notes also have no Core command. No digest or
physical ID input is exposed to the Player UI.

## React surface and pairing integration

`OnlineGuidedActions` props are exactly:

```text
projection: unknown
interactionState: "ready" | "updating" | "offline"
onAction(action: OnlineGuidedActionV1): void
```

It renders five labelled sections: `コントロール`, `ライブラリー探索`,
`裏向き情報`, `戦闘`, and `手動修正`. Search/control/combat use native forms
and an explicit confirmation before emission. Face-down and both correction
forms are manual-only and keep that status visible before and after emission.
No action is drag-, double-click-, or pointer-only. Updating/offline disables
emission while leaving status and manual boundary readable.

`OnlineDisplayPairing` composes the new surface under the paired status and
adds exactly one required `onGuidedAction` callback. A pairing validation
failure removes all three child surfaces. Re-rendering the same mutated input
must recompute and discard stale choices/confirmation. The component does not
bind a protocol frame, access a capability, or claim an acknowledgement.

One adaptive React tree serves 375x812 portrait, 812x375 landscape, and
1440x900 desktop. All five families, their status labels, and native controls
remain reachable by ordinary scrolling with no fixed overlay or horizontal
overflow. Focus is visible and meaning does not depend on color. The surface
uses existing tokens, Japanese UI text, and stable `data-testid` values. It
adds no audio, motion, remote asset, shared token, or dependency.

The exact stable structural test IDs are `online-guided-actions`,
`guided-control`, `guided-search`, `manual-face-down`, `guided-combat`, and
`manual-correction`. Action/form descendants use deterministic IDs prefixed by
their enclosing structural ID; text or hidden identity is never interpolated
into an attribute.

## Module and write boundary

Implementation is bounded to:

- pure model/types/error/barrel and ordinary tests under
  `src/online/guidedActions/**`;
- `src/components/online/OnlineGuidedActions.tsx`,
  `onlineGuidedActions.css`, ordinary tests, and the necessary successor edit
  to `OnlineDisplayPairing.tsx`;
- the existing dev-only `src/dev/displayPairing/**` and
  `research/design/display-pairing/index.html` fixture.

The pure module may import only public `src/online/projection/index.ts`,
`src/online/protocol/index.ts`, `src/online/displayPairing/index.ts`, and
`src/engine/core/index.ts` barrels. The React module may import only React and
the public guided-actions barrel plus CSS. Pairing may import the component and
public action type. No private Core/Room/protocol/projection file, Cloudflare,
headless, Store, Solo, GameScreen, root Online barrel, network/storage/timer,
App integration, version, dependency, Vite config, cache schema, or shared
design token is changed.

Judge-owned review and architecture tests may register the one new Online
root and successor component import. Implementers do not edit `review.*`,
contracts, ledgers, governance, or git state.

The public `src/online/guidedActions/index.ts` runtime exports are exactly:

```text
ONLINE_GUIDED_ACTIONS_SCHEMA_VERSION_V1
OnlineGuidedActionsErrorV1
OnlineGuidedActionBindingErrorV1
buildOnlineGuidedActionsViewV1
createOnlineGuidedActionV1
bindOnlineGuidedCommandActionV1
```

The barrel also exports the named V1 view, candidate, action, binding-input,
and error types required by those functions, with no unversioned alias.

## Required evidence

- Judge-owned DOM review proves five reachable families, hidden/concealed
  non-leakage, generic failures, exact frozen actions, manual-only truthfulness,
  confirmation, interaction states, and stale-input invalidation.
- Judge-owned protocol review proves exact validator-accepted envelopes for all
  four guided commands and rejection of every manual member and binding drift.
- Judge-owned architecture review proves the public-barrel/write boundary and
  dev-only integration.
- Ordinary tests cover pure view/action construction and component forms.
- One stable browser session verifies 375x812, 812x375, and 1440x900,
  horizontal overflow zero, no fixed overlap, and console errors zero.
- One independent BROAD cold audit precedes one fingerprint-matched full
  `npm run check`.

## Explicit DEFER / non-goals

No Projection/protocol/Core schema change, new command kind, automatic search
criteria engine, automatic control/combat legality engine, full combat damage,
face-down identity reconstruction, executable face-down command, executable
life/Commander correction from the Player projection, arbitrary state edit,
optimistic state, acknowledgement handling, network client, reconnect/outbox,
capability UI/storage, App/root integration, Solo migration, DnD, Scryfall,
audio, motion, or O4P-00B ruleset update. Unsupported compound behavior remains
guided/manual and is never displayed as fully automated. O4P-05A remains
pending after O4P-04D ships.
