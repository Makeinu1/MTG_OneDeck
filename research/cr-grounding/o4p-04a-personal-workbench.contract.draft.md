# O4P-04A Personal Workbench contract

Date: 2026-08-14

Milestone: `O4P-04A`

Base SHA: `64ac8c6de1bc62262154cebf5419ae82d13bc3cb`

Status: frozen judge-owned candidate contract

Risk: R2 UI behavior with a private-information boundary

## Goal and diagnosis

The shipped Solo `GameScreen` renders and mutates the legacy Zustand
`GameState`. The shipped Online application instead exposes a closed,
audience-specific `OnlineParticipantProjectionV1`, and no production UI consumes
that projection. Reusing the Solo store as an Online view model would recreate
hidden state outside the projection contract and would let components bypass
Room authority.

O4P-04A therefore adds one Personal Workbench that renders only a validated
Player projection and emits bounded, typed player intents. It does not adapt an
Online projection into Solo `GameState`, call a Core reducer, or own transport.

## Input and fail-closed boundary

The production model entry receives `unknown` and must call the shipped
`validateOnlineParticipantProjectionV1` before reading semantic fields. An
accepted workbench input must satisfy all of the following:

1. the projection validator succeeds;
2. `role === "player"` and `corePlayerId !== null`;
3. the projected participant exists exactly once as a connected Player;
4. exactly one projected seat binds that participant to `corePlayerId`;
5. the seat outcome is `pending` and the Room lifecycle is `active` or
   `finished`;
6. projected spell-copy, activated-ability, and triggered-ability objects occur
   only in the shared stack.

Any failure produces one generic Japanese unavailable state. It must not render
raw issue paths/messages, caller values, object/card/definition text, IDs,
capabilities, thrown text, or a stack. Validation does not mutate the caller.

## View model

`buildPersonalWorkbenchViewV1(unknown)` returns a fresh deeply frozen
`PersonalWorkbenchViewV1` containing only copied projection facts:

- schema version, revision, own Core player ID and seat index;
- Room lifecycle and own presence/outcome;
- turn number, active player, phase, and step;
- four player summaries in projected `turnOrder` with public life, poison,
  energy, experience, mana, status, and public hand/library/graveyard counts;
- the own private hand as visible cards plus generic hidden placeholders;
- shared battlefield, stack, exile, and command zones in canonical projected
  order;
- own library/graveyard counts and the filtered SearchSession,
  VisibilityGrant, and PlayPermission counts already present in the projection.

The public view shape is exact:

```text
kind:            "personal-workbench-view-v1"
schemaVersion:   1
revision
corePlayerId
seatIndex
roomLifecycle
presence
outcome
turn:            { activePlayerId, turnNumber, phase, step }
players:         readonly PersonalWorkbenchPlayerSummaryV1[]
zones:           {
  ownHand, ownLibraryCount, ownGraveyard,
  battlefield, stack, exile, command
}
authorityCounts: { visibilityGrants, searchSessions, playPermissions }
```

Every zone other than `ownLibraryCount` is exactly `{ count, cards }`. A Player
summary contains `playerId`, `isSelf`, `isActive`, public counters/resources,
mana, status, and the three public zone counts. A card is one of the closed
forms:

```text
{ kind: "hidden-card" }
{ kind: "stack-object", objectId,
  objectKind: "spell-copy" | "activated-ability" | "triggered-ability",
  label: "呪文のコピー" | "起動型能力" | "誘発型能力",
  controllerPlayerId }
{ kind: "concealed-card", objectId, label, tapped, phasedOut, counters,
  markedDamage }
{ kind: "visible-card", objectId, label, typeLine, manaCost, oracleText,
  ownerPlayerId, controllerPlayerId, commander, tapped, phasedOut, counters,
  markedDamage }
```

`label` is already display-ready. Counter entries preserve projected order.

The `stack-object` form is used only for validator-accepted synthetic stack
objects whose projection intentionally has no card runtime. It preserves only
the public object kind, handle, controller, and fixed Japanese kind label; it
does not reconstruct ability text, a source, definition, runtime, targets,
choices, or legality. A spell copy also uses this generic form and does not
promote its projected definition into a card-shaped runtime.

Visible cards use only the projected definition snapshot and public runtime.
The display name is `definition.name` wrapped in Japanese brackets `《》`.
`hidden-card` is rendered only as a generic card back with no key, identifier,
definition, runtime, accessible label, title, DOM attribute, or text derived
from hidden identity. `concealed-object` is rendered as `《裏向きのカード》`
with public tapped/counter/nonzero-damage facts only; it never gains owner, controller,
definition, face, or Oracle text.

The model preserves every projection order. It does not sort, trim,
deduplicate, merge, default, or retain a previous projection. It has no ambient
time, RNG, network, storage, DOM, React, locale, or logging dependency.

## Player action surface

The component emits a fresh deeply frozen `PersonalWorkbenchActionV1` and does
not mutate local or server state:

```text
{ kind: "request-refresh", knownRevision }
{ kind: "priority-pass", actorPlayerId, baseRevision }
{ kind: "concede", actorPlayerId, baseRevision }
```

Refresh is always available. Priority pass is available only while the Room is
active, the own seat outcome is pending, and the own projected player's
lifecycle status is `active`. Because the O4P-02D projection intentionally omits
the priority holder, `turn.activePlayerId` must not be used as a priority proxy.
The UI labels pass as a server-authorized attempt and never claims legality
before a later acknowledgement. Concede uses the same pending-player gate and
requires an explicit confirmation surface. After a concede intent at revision
N, a second concede at the same player/revision is disabled until a new
projection arrives. Buttons are native keyboard-focusable controls; no
operation is drag-, double-click-, or pointer-only.

The intents contain no participant ID, Room ID, capability, command ID,
decision context, or Core command. O4P-04C owns transport/session binding and
intent-to-envelope translation. A pending/reconnecting caller may disable
server-bound actions through the component's closed `interactionState` prop,
but the workbench never invents a successful acknowledgement.

The concede confirmation captures the current `{ corePlayerId, revision }`
when it opens. It remains renderable and submittable only while that pair still
matches the current validated view. Any Player or revision change invalidates
the confirmation and requires a new confirmation for the new view.

The component is exported as `PersonalWorkbench`. Its props are exactly
`projection: unknown`, `interactionState: "ready" | "updating" | "offline"`,
and `onAction(action): void`.

## Responsive and visual contract

One adaptive React tree serves 375x812 portrait, 812x375 landscape, and
1440x900 desktop. It preserves, without a fixed overlay covering content:

- own status and connection state;
- current turn/phase;
- four public player summaries;
- own hand and every visible card reachable by scrolling;
- battlefield/stack/public zones;
- refresh, priority-pass, and concede controls.

The workbench uses existing design tokens and the established dark/light theme
variables. It adds no global token, animation, audio, remote asset, or new
dependency. Focus remains visible, labels do not rely on color alone, and the
DOM has stable `data-testid` values for the root, status, player summaries,
zones, cards/placeholders, and three action controls.

Canonical Player lifecycle literals stay in the model, but the component maps
`active` to `プレイ中` and `exited` to `退席済み`; it does not expose raw
protocol status literals as Japanese UI text.

## Module and write boundary

Production implementation is additive:

- pure model/types/barrel under `src/online/workbench/**`;
- React/CSS under `src/components/online/**`;
- a dev-only browser fixture under `src/dev/personalWorkbench/**`;
- one dev fixture entry at `research/design/personal-workbench/index.html`.

The pure workbench module may import only the public
`src/online/projection/index.ts` barrel. It cannot import Core, Room, protocol,
Cloudflare, headless, Store, Solo, React, DOM, or browser modules. The React
component may import only React and the public workbench barrel plus its CSS.
No existing production file, `src/online/index.ts`, dependency, Vite config,
version, cache schema, or shared design token is changed.

The source graph has no import from `src/store`, `src/components/game`,
`src/online/cloudflare`, `src/online/protocol`, or a Core reducer. Those layers
also do not import the workbench in O4P-04A.

## Required evidence

- Judge-owned DOM review proves projection validation, Player-only fail-close,
  own-hand/public rendering, hidden/concealed non-leakage, frozen intents,
  confirmation, and generic errors.
- Judge-owned architecture review proves the additive import/write boundary
  and fixture separation.
- Ordinary model/component tests cover canonical view construction and
  interaction states.
- One stable browser session verifies 375x812, 812x375, and 1440x900 with zero
  console errors on the deterministic fixture.
- The frozen candidate receives an independent cold audit before one
  fingerprint-matched `npm run check`.

## Explicit DEFER / non-goals

No WebSocket/fetch/Cloudflare client, endpoint selection, Room creation/join,
capability input/storage/rotation, localStorage/IndexedDB, reconnect timer,
outbox, acknowledgement handling, command construction, optimistic state,
Table/Spectator UI, pairing, opponent focus, search/control/face-down/combat
guided flow, manual correction flow, Solo store migration, DnD, audio, motion,
Scryfall fetch, image URL reconstruction, or release-ruleset update. O4P-04B
owns Table Display, O4P-04C owns pairing/transport binding, and O4P-04D owns the
deferred guided/manual action families.
