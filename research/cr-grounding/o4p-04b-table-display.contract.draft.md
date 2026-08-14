# O4P-04B Table Display contract

Date: 2026-08-14

Milestone: `O4P-04B`

Base SHA: `36237478838695e4cb1753bafaba0bc1aa4fa8f4`

Status: frozen judge-owned candidate contract

Risk: R2 UI behavior with a public/private projection boundary

## Goal and diagnosis

O4P-02D already exposes one audience-specific `OnlineParticipantProjectionV1`
whose `role: "table"` form is the TableProjection contract. O4P-04A added a
Player-only Personal Workbench, but reusing it for a table screen would invent
an own player, expose Player actions, and invite private-zone rendering that a
shared display does not need.

O4P-04B therefore adds one read-only Table Display that renders only a
validated Table projection. It does not create a second projection schema,
adapt a projection into Solo `GameState`, call a Core/Room reducer, or own
transport, pairing, refresh, or acknowledgement behavior.

## Input and fail-closed boundary

The production model entry receives `unknown` and must call the shipped
`validateOnlineParticipantProjectionV1` before reading semantic fields. An
accepted Table Display input must satisfy all of the following:

1. the projection validator succeeds;
2. `role === "table"` and `corePlayerId === null`;
3. the audience participant exists exactly once with role `table` and
   `seatIndex === null`;
4. exactly four projected seats and four projected players correspond one to
   one with `game.turnOrder`, and every seat binds exactly one projected Player
   participant;
5. hidden-card entries occur only in per-player hand or library zones;
6. projected spell-copy, activated-ability, and triggered-ability objects occur
   only in the shared stack.

Any failure produces one generic Japanese unavailable state. It must not render
raw issue paths/messages, caller values, object/card/definition text, IDs,
capabilities, thrown text, or a stack. Validation does not mutate the caller.

## View model

`buildTableDisplayViewV1(unknown)` returns a fresh deeply frozen
`TableDisplayViewV1` containing only copied projection facts:

- schema version, revision, Room lifecycle, and the Table participant presence;
- turn number, active player, phase, and step;
- four player summaries in projected `turnOrder`, each with seat index,
  presence/outcome, public life, poison, energy, experience, mana, lifecycle
  status, and public hand/library/graveyard counts;
- shared battlefield, stack, exile, and command zones in canonical projected
  order.

The public view shape is exact:

```text
kind:            "table-display-view-v1"
schemaVersion:   1
revision
roomLifecycle
tablePresence
turn:            { activePlayerId, turnNumber, phase, step }
players:         readonly TableDisplayPlayerSummaryV1[]
zones:           { battlefield, stack, exile, command }
```

Every zone is exactly `{ count, cards }`. A Player summary contains
`playerId`, `seatIndex`, `isActive`, `presence`, `outcome`, public counters and
mana, `status`, and the three public zone counts. A rendered card is one of the
closed forms:

```text
{ kind: "stack-object", objectId,
  objectKind: "spell-copy" | "activated-ability" | "triggered-ability",
  label: "呪文のコピー" | "起動型能力" | "誘発型能力",
  controllerPlayerId }
{ kind: "concealed-card", objectId, label, tapped, phasedOut, counters,
  markedDamage }
{ kind: "visible-card", objectId, label, typeLine,
  ownerPlayerId, controllerPlayerId, commander, tapped, phasedOut, counters,
  markedDamage }
```

Visible cards use only the projected definition snapshot and public runtime.
The display label is `definition.name` wrapped in Japanese brackets `《》`.
Synthetic stack objects use only their public kind, handle, controller, and a
fixed Japanese label; the display does not reconstruct source, definition,
runtime, text, targets, choices, or legality. Concealed objects render as
`《裏向きのカード》` with only their public tapped/phased/counter/nonzero-damage
facts. They never gain owner, controller, definition, face, or Oracle text.

Per-player hand and library entries are never copied to the Table Display view,
including publicly revealed identities. Only their validator-approved counts
are retained. Per-player graveyard identities are also omitted from this
overview; only its count is retained. This is an intentional minimum-disclosure
UI boundary, not a change to projection visibility semantics. Shared-zone
`hidden-card` values fail closed and are never represented by a hidden-card view
variant.

The model preserves every projection order. It does not sort, trim,
deduplicate, merge, default, or retain a previous projection. It has no ambient
time, RNG, network, storage, DOM, React, locale, or logging dependency.

## Turn and priority truthfulness

The Table projection contains the active turn player and turn position, but it
does not contain the current priority holder. The component therefore renders
the active player as `手番` and a persistent Japanese statement that priority
holder information is not included in the projection. It must not infer
priority from `activePlayerId`, stack order, seat order, lifecycle, or any UI
state, and must not label any Player as holding priority.

## Read-only component

The component is exported as `TableDisplay`. Its props are exactly
`projection: unknown`. It exposes no callback, action, control, form, editable
surface, drag/drop, double-click operation, timer, polling, or optimistic state.
O4P-04C owns transport/session binding, display pairing, and refresh behavior.

## Responsive and visual contract

One adaptive React tree serves 375x812 portrait, 812x375 landscape, and
1440x900 desktop. It preserves, without a fixed overlay covering content:

- Table connection/Room state and current turn/phase;
- the explicit priority-information boundary;
- four public Player summaries;
- battlefield, stack, exile, and command zone counts and cards;
- all content reachable by ordinary document scrolling.

The Table Display uses existing design tokens and the established dark/light
theme variables. It adds no global token, animation, audio, remote asset, or new
dependency. Status meaning does not rely on color alone. Stable `data-testid`
values identify the root, status, priority boundary, player summaries, zones,
visible cards, concealed cards, and generic stack objects.

Canonical Player lifecycle literals stay in the model, but the component maps
`active` to `プレイ中` and `exited` to `退席済み`; Room presence maps to
`connected` as `接続中` and `disconnected` as `切断中`. Raw protocol status literals are not used
as Japanese UI labels.

## Module and write boundary

Production implementation is additive:

- pure model/types/barrel under `src/online/tableDisplay/**`;
- React/CSS under `src/components/online/**`;
- a dev-only browser fixture under `src/dev/tableDisplay/**`;
- one dev fixture entry at `research/design/table-display/index.html`.

The pure Table Display module may import only the public
`src/online/projection/index.ts` barrel. It cannot import Core, Room, protocol,
Cloudflare, headless, workbench, Store, Solo, React, DOM, or browser modules.
The React component may import only React and the public Table Display barrel
plus its CSS. No existing production file, root Online barrel, dependency,
Vite config, version, cache schema, or shared design token is changed.

The source graph has no import from `src/store`, `src/components/game`,
`src/online/workbench`, `src/online/cloudflare`, `src/online/protocol`, or a Core
reducer. Those layers also do not import the Table Display in O4P-04B.

## Required evidence

- Judge-owned DOM review proves Table-only validation, four-player overview,
  public shared-zone rendering, hidden/concealed non-leakage, truthful priority
  labeling, generic errors, and the absence of action surfaces.
- Judge-owned architecture review proves the additive import/write boundary
  and fixture separation.
- Ordinary model/component tests cover canonical view construction and
  responsive structure.
- One stable browser session verifies 375x812, 812x375, and 1440x900 with zero
  console errors on the deterministic fixture.
- The frozen candidate receives an independent cold audit before one
  fingerprint-matched `npm run check`.

## Explicit DEFER / non-goals

No WebSocket/fetch/Cloudflare client, endpoint selection, Room creation/join,
capability input/storage/rotation, localStorage/IndexedDB, reconnect timer,
outbox, refresh intent, acknowledgement handling, command construction,
optimistic state, Player action, Personal Workbench integration, display
pairing, opponent focus, search/control/face-down/combat guided flow, manual
correction flow, Solo store migration, audio, motion, Scryfall fetch, image URL
reconstruction, or release-ruleset update. O4P-04C owns pairing/transport
binding and opponent focus; O4P-04D owns guided/manual action families.
