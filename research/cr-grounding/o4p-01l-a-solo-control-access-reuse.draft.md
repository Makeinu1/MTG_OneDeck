# O4P-01L grounding lane A — Solo control/access reuse matrix

Status: `drafted` / Architecture Analyst evidence draft; not a contract, implementation, audit, or shipment decision.

Base: PLAN_SHA `be3240e77e2c1cfc6be30707bbc3f052c2524b9a`.

## Scope and fixed-rule grounding

This lane inspects existing Solo control, visibility, search, and play paths for reuse by the additive mode-neutral Core rule bundle. It changes no product code and does not turn existing Solo behavior into multiplayer automation.

Relevant pinned rules are CR 400.7 (zone move creates a new object), CR 401.2–401.5 and 402.1–402.3 (library/hand hidden-information boundaries), CR 601.2 and 602.2 (casting/activation actor and controller), CR 609.1–609.4 (effect scope), CR 611.1–611.3d (continuous effects and duration), and CR 613.1b (control in layer 2). CR 701.15 is also a guard against collapsing player-attributed designations into control.

## Reuse matrix

| Existing concern | Evidence | Classification | Decision |
|---|---|---|---|
| `setController` | `src/engine/commands.ts:6996-7001` | `REJECT` | Solo visible-card correction only; not a Core `ControlEffect`. |
| `CardInstance.ownerId` / `controllerId` | `src/engine/types.ts:25-51` | `ADAPT` | Preserve ownership and current facts, but derive Core controller from effects. |
| Zone-change reset | `src/engine/commands.ts:721-758`, `1354-1366` | `SHARE_DIRECT` | Share object-incarnation/reset invariants, not the Solo mutation path. |
| `eligibleTargets` | `src/engine/commands.ts:5572-5660` | `ADAPT` | Reuse predicate ideas only with explicit player, visibility, and permission context. |
| Current-controller usage | `src/engine/commands.ts:5577-5579`, `src/store/gameStore.ts:1983-1989` | `ADAPT` | Use a required derived query; reject implicit `localPlayerId` fallback. |
| Summoning sickness / `enteredTurn` | `src/engine/status.ts:632-638`, `src/engine/commands.ts:1166-1169` | `ADAPT` | Keep entered-turn evidence, but use Core continuity for controller changes. |
| Attachment | `src/engine/types.ts:50`, `src/engine/commands.ts:6985-6994` | `REFACTOR_BEFORE_CORE` | Existing setter lacks typed legality and cleanup boundaries. |
| Library-search helpers | `src/store/gameStore.ts:4933-4967`, `review.cr701-library-search.test.ts` | `ADAPT` | Reuse mechanics only behind explicit searcher/selector/visibility context. |
| Scryfall/CardDef visibility assumptions | `src/types/card.ts:3-54` | `REFACTOR_BEFORE_CORE` | Complete CardDef data is not proof that a viewer may inspect a hidden card. |
| Hand/library UI access | `src/engine/types.ts:104-119`, `src/store/gameStore.ts:717-750` | `REFACTOR_BEFORE_CORE` | Storage is player-scoped; projection/access policy is separate. |
| Opponent setup | `addOpponent` / `applyOpponentSetup`, `src/engine/commands.ts:6620-6647` | `ADAPT` | Fixture/setup substrate only; synthetic dummies do not grant authority. |
| Play-from-zone logic | `src/store/gameStore.ts:3470-3520`, `1003-1035` | `REFACTOR_BEFORE_CORE` | Existing Solo entry points mix action, movement, and legality. |
| Controller-specific costs | `src/store/gameStore.ts:2450-2675`, `src/engine/manaTransaction.ts:85-112` | `ADAPT` | Payer concepts may be shared after actor/controller separation. |

## Why `setController` is rejected

`setController` validates a destination player, replaces `card.controllerId`, and logs the change. It has no effect source, affected-object snapshot, timestamp/order, duration, layer, or zone-incarnation boundary. It therefore cannot represent CR 611.2c resolving effects, CR 611.3 static reevaluation, or CR 613.1b layer-2 ordering. Reusing it would silently turn an effect history into a mutable Solo field and would lose the prior controller when an effect is removed.

## Directly shareable substrate and required adaptation

Safe sharing is limited to read-only, dependency-free facts: physical object identity, owner identity, zone-change/object-incarnation evidence, player-scoped zone membership, English `oracleText` versus display-only `printedText`, and basic pure predicates after explicit context is added. Existing `zonesByPlayer` is useful storage evidence, but Core visibility must take an explicit viewer and grant context. Existing search/shuffle helpers are execution leaves only; they must not decide who may search or inspect hidden cards.

Core must add independent representations for:

1. A control effect with source, target object incarnation, resulting controller, order, and duration; current controller is derived.
2. Decision authority with rules actor, decision maker, controlled player, and scoped lifetime; it does not mutate object controller or active player.
3. Visibility grants and search sessions with viewer/selector, zone, candidate snapshot, reveal mode, and source/duration.
4. Play permissions with actor, object/top-library subject, expected zone, action, and attempt-only semantics.
5. Attachment/continuity prerequisites; `attachedTo?: string` and a Solo setter are insufficient for effect-dependent Core rules.

## Required investigation results

- **setController:** `REJECT`; it is a Solo setup/correction command, not a Core effect.
- **owner/controller:** `CardInstance.ownerId` is stable ownership; `controllerId` is a current Solo fact. Core must never infer owner from controller or vice versa.
- **zone-change reset:** `SHARE_DIRECT` as an invariant/reference only; CR 400.7 invalidates the old object and requires a new Core object identity context.
- **eligibleTargets:** `ADAPT`; target legality must include viewer, actor, effective controller, and permission context.
- **current controller:** `ADAPT`; query effective controller at a rules moment instead of writing one field.
- **summoning sickness / enteredTurn:** `ADAPT`; continuity since the relevant controller's most recent turn began is not equivalent to one Solo turn number.
- **attachment:** `REFACTOR_BEFORE_CORE`; typed target legality and state-based cleanup are absent.
- **library search helpers:** `ADAPT`; existing single-player mechanics do not supply rules actor, selector, candidate visibility, or stale-snapshot checks.
- **Scryfall/CardDef visibility:** `REFACTOR_BEFORE_CORE`; local complete definitions must not leak hidden-zone identity.
- **hand/library UI access:** `REFACTOR_BEFORE_CORE`; UI/projection is outside O4P-01L and must consume a future visibility query.
- **opponent setup:** `ADAPT`; scenario dummy paths seed tests only and do not establish multiplayer authority.
- **existing play-from-zone logic:** `REFACTOR_BEFORE_CORE`; it combines movement and full legality and has no attempt-permission boundary.
- **controller-specific costs:** `ADAPT`; payer routing may be reused only after actor, decision maker, resource owner, and source controller are explicit.

## Boundary scenarios

1. **Control:** indefinite and until-EOT changes require typed effects; multiple effects use an explicit order; removal restores the previous derived controller; source disappearance invalidates only the supported duration; a controlled permanent leaving the battlefield is a new object. Stack spells may be controlled; activated/triggered ability objects are not Core control targets.
2. **Access:** own hand is the existing Solo baseline; opponent hand and libraries remain hidden absent a grant; public face-up objects remain public; face-down battlefield/stack and exile need explicit Core rules. UI and network projection are not reused.
3. **Search:** existing helpers do not answer who searches, who selects, whose zone is searched, which hidden candidates are inspectable, or whether a snapshot is stale. Core must separate searcher/rules actor from selector/decision maker and must not move cards or shuffle.
4. **Play:** a permission may identify a card or top-library position and the allowed actor, but it is not timing, card-type, cost, payment, land-count, or Commander legality. Visibility is a prerequisite for face-down exile identity.
5. **Opponent-turn authority:** existing `localPlayerId` assumptions are not reusable. Controlled-player resources and object controllers remain scoped to the controlled player/object; concession and outside-the-game choices are not delegated.

## DEFER / contradictions / ambiguities

- **DEFER:** Network Projection, WebSocket/Cloudflare, UI, full static-layer/dependency evaluator, timestamp conflict resolution, attachment/SBA completion, combat, Commander consequences, full tutor/filter parsing, movement, shuffle, and full cast/land legality.
- A `controllerId` write cannot represent CR 611/613 effect history; therefore current Solo mutation and Core effective-controller derivation must remain separate.
- A local CardDef or UI zone list may contain hidden data for storage/testing, but it cannot by itself establish viewer permission.
- “Current controller” for a hidden/private zone must be defined at a rules moment for a specific object incarnation; missing fields must not silently fall back to local player.
- Existing two-player turn/local-player assumptions do not define four-player decision authority. The Core contract must require actor/decision-maker context where the milestone claims it.

## Acceptance implications

Acceptance must cover Solo preservation, `setController` rejection as a Core reuse path, owner/controller distinction, zone-change invalidation, multiple ordered effects, control continuity, hidden/public visibility, searcher/selector separation, no movement/no shuffle, face-down exile visibility prerequisite, attempt-only play permission, controlled-player authority, unchanged active player/object controllers, and all explicit O4P-01L defers.
