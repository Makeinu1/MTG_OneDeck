# Multiplayer Foundation + Opponent Setup — contract draft

> Status: **JUDGE-RULED AND SHIPPED**(裁定 2026-07-15 → 出荷監査 2026-07-16)
>
> User decision: 2026-07-15 (STOP①「V4前進 vs V1磨き込み」をチャットでV4前進へ裁定).
>
> 判定者裁定: 方向性・CRアンカー・スライス順序を**8点修正の上で承認**。契約正本は
> `docs/engine-spec.md` §34.42(修正一覧込み)。主要修正=①`commanderDamage` はキーが
> 相手*統率者*ラベルでありスコープ外 ②3つの identity scheme(本草稿の最大の欠落)の統一は
> 全単射確立であって storage 再キーではない(→MP-IDENTITY)③ミラー極性は MP-STATE では
> 反転しない ④`updateScenarioDummy`/`removeScenarioDummy` は第一級コマンドとして却下
> (分解可能性テスト)⑤§6の「全ゲート緑まで rule leaf 停止」は不採用(MP-ZONES/COMMANDS
> 緑で cross-player draw が解錠されるため、そこで北極星⑤メタレビュー)。
>
> 実装: MP-STATE=Codex(判定者発注)、MP-ZONES/COMMANDS〜MP-BOARD=J0(ユーザー許可の
> 判定者不在運用)。復帰判定者が4層独立再検証(review diff精読・冷Tier-1・機械4点・実機E2E)
> の上で再オーナー化し出荷。§34.43〜45 参照。

## 1. Authority and intent

The user has chosen the roadmap branch reserved by the ledger selection rule:
advance toward V4 multiplayer now instead of finishing the remaining P1-centric
rule leaves first. The immediate deliverable is not networking, AI, opponent-deck
import, or a completed four-player board. It is a local, deterministic multiplayer
spine that makes a second player real in canonical state, commands, events,
rendering, and executable scenarios.

CR anchors:

- CR 102.1: active and nonactive players are first-class participants.
- CR 103.1: turn order is an ordered player relation, not a two-value toggle.
- CR 103.4c: each Commander player starts at 40 life.
- CR 110.2: every permanent has an owner and controller.
- CR 110.5: tapped/untapped and other permanent status are state, not display-only data.
- CR 400.1: library/hand/graveyard are per-player; battlefield/stack/exile/command are shared.
- CR 400.3: an object moving to a private zone goes to its owner's corresponding zone.
- CR 400.7: zone movement creates a new object; scenario dummies use the same incarnation rules.
- CR 800.1: more than two players is a multiplayer game.
- CR 800.4: later online multiplayer must be able to distinguish players that remain in or leave the game.

Limited range of influence (CR 801) is not enabled by default and is outside this
slice. Free-for-all Commander uses the ordinary all-opponents model.

## 2. Required architecture decision

### 2.1 Player identity and order

Replace the closed `PlayerId = 'P1' | 'OPPONENT_A'` assumption with opaque,
serializable player ids stored by the game. The initial local game creates `P1`
and one opponent, while the state shape accepts two through four participants.

Proposed state responsibilities (names are judge-adjustable; responsibilities are not):

```ts
type PlayerId = string; // validated opaque id; not arbitrary unchecked UI text

interface PlayerState {
  id: PlayerId;
  label: string;
  life: number;
  poison: number;
  energy: number;
  experience: number;
  manaPool: ManaPool;
  zones: PlayerPrivateZones;
  inGame: boolean;
}

interface GameState {
  players: Record<PlayerId, PlayerState>;
  turnOrder: PlayerId[];
  localPlayerId: PlayerId;
  activePlayerId: PlayerId;
  // Shared zones remain canonical shared arrays.
}
```

The exact migration of legacy `life`, `poison`, `manaPool`, `opponentLife`, and
`zonesByPlayer` must be spec-locked before code. Compatibility fields may remain
as boundary projections during staged migration, but there must be exactly one
canonical writer for each value.

### 2.2 Player-aware commands and events

Commands that read or write player-owned state must carry an explicit player
subject after normalization. At minimum this includes draw, discard, mill,
life, mana, search/shuffle, token/dummy creation, combat participant selection,
and player-target effects. Existing omitted-player call sites may be accepted at
the store/UI boundary during migration and normalized to `localPlayerId`; the
pure engine must not silently infer P1.

Events must preserve actor/controller/affected-player identity so opponent draw,
cast, ETB, death, discard, sacrifice, counter, life, and damage events can drive
observer-scoped triggers. `you` is the source spell/ability controller, not the
local UI player. `opponent` and `each opponent` are derived from that controller
and the in-game player set.

### 2.3 Zones and board projection

Per CR 400.1, do not create a separate battlefield zone for each player. Keep a
single shared battlefield and derive each visible board group from
`controllerId`. Private-zone writes route by owner under CR 400.3. The legacy
flat P1 private arrays may survive temporarily as read-only/backward-compatible
projections but must not remain the canonical multiplayer writer.

## 3. Scenario dummy substrate

Scenario dummies are synthetic game objects, not Scryfall cards and not
necessarily Magic tokens. Add an explicit typed marker such as
`CardInstance.isScenarioDummy`; do not infer dummy identity from id prefixes.
Legacy snapshot backfill defaults it to false.

A dummy permanent definition contains no oracle text or image and supports:

- Japanese display name;
- one or more broad permanent types from Creature, Artifact, Enchantment, Land,
  and Planeswalker;
- numeric base power/toughness for creatures;
- tapped state;
- counters;
- existing manual keyword ids;
- an explicit `isToken` choice, default false.

The engine registers a deterministic synthetic `CardDef` plus ordinary
`CardInstance`. Once applied, dummies travel through ordinary target filtering,
combat, damage, SBA, controller changes, and zone changes. A non-token dummy sent
to a private zone routes to its owner's zone. A token dummy receives the existing
token cease behavior. Setup reconciliation may mutate only objects marked as
scenario dummies; it must not delete ordinary cards merely because an opponent
currently controls them.

Proposed pure command surface:

```ts
type ScenarioDummySpec = {
  scenarioId: string;
  name: string;
  ownerId: PlayerId;
  controllerId: PlayerId;
  permanentTypes: PermanentType[];
  power?: number;
  toughness?: number;
  tapped: boolean;
  counters: Record<string, number>;
  manualKeywords: string[];
  isToken: boolean;
};

type GameCommand =
  | { type: 'createScenarioDummy'; spec: ScenarioDummySpec }
  | { type: 'updateScenarioDummy'; cardId: string; spec: ScenarioDummySpec }
  | { type: 'removeScenarioDummy'; cardId: string }
  | /* existing commands */;
```

The judge should decide whether update/remove are legitimate first-class engine
commands or must compile into smaller existing primitives. The acceptance
invariant is that confirmation produces a deterministic `GameCommand[]`, is
applied through `applyCommands`, and is one store-history entry.

## 4. Independent opponent-setup screen

The editor is a separate full-screen view, not a panel, drawer, overlay, or board
editing mode. It is reachable from the in-game menu and returns to the same live
game. Opening it creates transient draft data from canonical state. Draft edits
do not touch `GameState` or history.

V1 draft scope:

- opponent life and poison;
- opponent-owned/opponent-controlled scenario dummies on the battlefield;
- add, duplicate, edit, delete, and reorder;
- confirm and cancel.

Cancel discards the draft. Confirm diffs draft against the still-current live
state, rejects or refreshes if the underlying relevant state changed while the
editor was open, compiles the diff to deterministic commands, and applies the
whole batch as one undo unit. Reopening rehydrates from the applied state.

Opponent deck import, Scryfall search, AI, saved scenarios, networking, and UI
editing of opponent private zones are deferred. Tests may seed private zones
through engine fixtures before that UI exists.

## 5. Main-board integration

The game screen remains the play surface, not the editor. It gains controller-
grouped shared-battlefield projections. The existing local Board/LandRow show
local-controller permanents; reusable opponent-board projections show opponent
creatures, other permanents, and lands. The component boundary accepts a
PlayerId/controller instead of encoding P1 versus opponent A.

Opponent objects use the ordinary card interaction and target-selection paths.
`eligibleTargets` must include dummies and apply controller/type/token filters.
The editor itself is never opened as part of choosing a target or resolving a
spell.

## 6. Delivery slices and gates

This proposal is too large for one implementation milestone. After judge spec
promotion, deliver in this order, with green checks after every slice:

1. **MP-CONTRACT**: approve player canonical state, compatibility strategy,
   command subject semantics, dummy command abstraction, invariants, and golden cases.
2. **MP-STATE**: N-player identity/order/state and lossless snapshot backfill;
   no new UI.
3. **MP-ZONES/COMMANDS**: owner-routed private zones and player-aware core
   commands/events; retire P1-only canonical writers.
4. **MP-DUMMY**: pure synthetic dummy lifecycle plus engine tests; no setup screen.
5. **MP-SETUP**: independent draft editor, cancel, confirm-as-one-batch, re-edit.
6. **MP-BOARD**: controller-grouped opponent board and ordinary target/combat integration.
7. **MP-FOUR-PLAYER-GATE**: headless 2/3/4-player APNAP, each-opponent, save/restore,
   and scenario replay checks. Resume rule leaves only after this gate is green.

Online synchronization and player-leaves-game behavior under CR 800.4 remain a
later phase. The local command stream must nevertheless stay deterministic,
serializable, and randomness-payload-complete so networking does not require a
second engine model.

## 7. Required invariants and acceptance cases

- Player ids in cards, events, combat, targets, zones, active player, and turn
  order always resolve to an in-game or explicitly retained historical player.
- `turnOrder` contains each in-game player exactly once; 2, 3, and 4 are accepted.
- Every private-zone card exists in exactly its owner's corresponding zone; no
  card id occurs in two player-private zones.
- Shared battlefield objects are partitionable by controller without duplicating
  the underlying shared-zone object.
- Editing a setup draft changes no canonical state or history.
- Cancel is a no-op; confirm is one batch and one undo; redo reproduces it.
- A created opponent 1/1 dummy is visible on the opponent board and is eligible
  for `target creature an opponent controls`.
- Artifact and land dummies match only the appropriate broad-type filters.
- Destroying a non-token dummy routes it to owner graveyard; a token dummy ceases
  through the existing token path after leaving the battlefield.
- A control-changed object moves between controller projections without changing
  physical id or owner.
- Opponent draw/ETB/death events can trigger local opponent-observer abilities.
- APNAP and `each opponent` are deterministic for 2, 3, and 4 players.
- Legacy P1 snapshots restore with P1 card order and state unchanged.
- Engine invariants, reviewer-owned tests, four machine checks, three UI viewport
  checks, and zero new browser console errors pass per UI-bearing slice.

## 8. Explicit deferrals

- Network transport, authentication, matchmaking, reconnection, hidden-information security.
- Finished four-player visual design.
- Real opponent cards, opponent deck import, and Scryfall search.
- AI and automatic opponent decisions.
- Saved/reusable scenario presets.
- CR 801 limited range of influence and non-free-for-all multiplayer variants.
- Complete CR 800.4 player-leaves-game processing.

