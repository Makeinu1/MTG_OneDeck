# O4P-01L-B Control-Effect Continuity V1 (grounding draft)

Status: `drafted` (Domain Analyst lane B; not judge-owned, not implemented)

Milestone: O4P-01L  
Base: `PLAN_SHA=be3240e77e2c1cfc6be30707bbc3f052c2524b9a`  
Rules authority: pinned local CR `2026-06-19` only

## 1. Purpose and boundary

This lane defines the smallest deterministic Core surface for control-changing
continuous effects and current-controller queries. It is additive to the
shipped Object Registry V2, Object Runtime V2, shared Stack/Stack Transaction
V1, card zone-transition identity, and O4P-01K turn lifecycle. It does not
resolve effects, move cards, choose targets, calculate permissions, or perform
the complete continuous-effect layer system.

The contract must distinguish the rules actor, effect source, affected object,
base controller, effective controller, and decision maker. A caller supplies
the already determined order of applicable control effects. That order is the
sole Layer-2 order in V1; the bundle must never sort, infer, or silently repair
it.

## 2. CR-grounded object model

- A battlefield permanent is an object on the battlefield with a controller;
  its default/base controller is the player under whose control it entered
  the battlefield (CR 110.2). A permanent is not synonymous with a card in a
  nonbattlefield zone (CR 110.4, 110.5d).
- A spell is an object on the stack. A permanent spell can become a permanent
  on resolution, but the spell and resulting permanent are separate zone
  objects. A spell copy is a spell on the stack, is not cast, and is
  controlled by the player who put it on the stack (CR 707.10).
- An activated or triggered ability on the stack is an ability object, not a
  permanent or spell card. A copied ability has the same source as the
  original ability, while a copied spell has no associated spell card (CR
  707.10, 707.10b).
- Objects outside the stack/battlefield normally have no controller; triggered
  abilities waiting to be put on the stack retain the controller of their
  source when it triggered (CR 109.4, 109.4b). The V1 query therefore returns
  `null` for an ordinary non-stack/non-battlefield object rather than treating
  owner as controller.
- “You” and “your” are resolved from the relevant controller/actor context,
  not from ownership (CR 109.5). The control slice reports controller facts;
  play/search/visibility and decision-authority slices consume those facts.

Recommended discriminated records:

```ts
type ControlObjectRefV1 = {
  readonly objectId: CoreObjectId;
  readonly kind: 'permanent' | 'permanent-spell' | 'spell' | 'spell-copy' |
    'activated-ability' | 'triggered-ability';
  readonly zone: 'battlefield' | 'stack';
};

type ControlEffectDurationV1 =
  | { readonly kind: 'indefinite' }
  | { readonly kind: 'until-end-of-turn'; readonly turnNumber: number }
  | { readonly kind: 'until-beginning-of-controller-turn'; readonly playerId: CorePlayerId; readonly turnNumber: number }
  | { readonly kind: 'while-source-exists'; readonly sourceRef: HistoricalObjectRefV1 }
  | { readonly kind: 'while-source-controlled'; readonly sourceRef: HistoricalObjectRefV1; readonly playerId: CorePlayerId }
  | { readonly kind: 'while-attached'; readonly sourceRef: HistoricalObjectRefV1; readonly attachedTo: HistoricalObjectRefV1 };

type ControlEffectV1 = {
  readonly effectId: string;
  readonly sourceRef: HistoricalObjectRefV1;
  readonly createdBy: 'resolution' | 'static-ability';
  readonly affectedObjectIds: readonly CoreObjectId[];
  readonly controller: CorePlayerId;
  readonly duration: ControlEffectDurationV1;
  readonly timestamp: number;
  readonly explicitOrder: number;
};
```

`HistoricalObjectRefV1` is an immutable reference to the object identity and
incarnation known when the effect was created. It may be absent from the
current registry. It is not a permission to resolve a new object with the
same printed name or physical card ID. A zone change creates a new object with
no memory or relation to the former object (CR 400.7); the existing card
transition already advances incarnation and resets runtime state. Unless a
specific CR 400.7 exception applies, a source-bound duration and a locked
affected-object set do not follow the new object.

## 3. Deterministic queries and operation surface

The minimum V1 API is pure and input-preserving:

1. `createControlEffectV1(input)` validates exact keys, seated players,
   positive safe-integer timestamp/order, valid source references, duration
   payloads, and a nonempty affected-object list. It returns a fresh deeply
   frozen effect.
2. `isControlEffectActiveV1(effect, state, temporalMark)` checks duration,
   source continuity, source controller, attachment relation, and turn mark.
   Missing source or missing affected object invalidates only the applicable
   effect/query result; it must not resurrect by name or mutate state.
3. `deriveBaseControllerV1(state, objectId)` returns the stored battlefield
   base controller, or `null` outside the battlefield. `deriveControllerV1`
   takes a caller-ordered active-effect list and folds it over base controller.
   It returns the effective controller plus the consulted effect IDs. It does
   not reorder, dependency-check, or apply non-control layers.
4. `advanceControlMarkV1(state, mark)` records the deterministic turn/step
   mark needed to evaluate end-of-turn and beginning-of-controller-turn
   expiration. The operation is a value transition only; it does not advance
   the game lifecycle or resolve triggers.
5. `invalidateControlEffectsForZoneChangeV1(state, transition)` removes or
   marks effects whose source/affected identity no longer satisfies CR 400.7,
   while retaining historical references needed for LKI-style queries. It
   must preserve unaffected effects and return a fresh canonical state.

Static effects are evaluated against the current object/source presence at the
query moment (CR 611.3a-b). Resolution-created effects lock their affected
object set at effect start (CR 611.2c). This distinction is mandatory: a
resolution-created “gain control of these objects” effect does not expand to
later entrants, while a static effect may apply to later objects matching its
text. A source that is absent before a `for as long as` effect begins means the
effect never starts and does nothing (CR 611.2b).

## 4. Duration, order, and continuity rules

- No stated duration is `indefinite`/until game end for a resolving effect
  (CR 611.2a), not “until source leaves.”
- “Until end of turn” expires at the defined turn boundary; “until the
  beginning of your next turn” uses the controller recorded when the effect
  was created and expires at that player’s next beginning mark. The query
  must not substitute the object’s later controller.
- “For as long as you control the source,” “while source exists,” and “while
  attached” are active predicates over the historical source/attachment
  references. They may stop the effect before a later application; they do not
  merge with a same-name replacement object.
- Effects created by resolution receive a timestamp at creation; static
  effects use the timestamp of their generating object/effect as specified by
  CR 613.7a-b. Timestamp is retained even when explicit Layer-2 order is
  caller-supplied.
- CR 613.1b places control-changing effects in Layer 2. CR 613.7 supplies
  timestamp ordering, and CR 613.8 defines dependency. Full CR 613 dependency
  evaluation is explicitly deferred. V1 accepts `explicitOrder` from the
  caller and folds exactly that order; duplicate, missing, or out-of-range
  order values are validation errors, never auto-sorted.
- If control changes during combat, the permanent is removed from combat (CR
  506.4). Control changes also affect summoning-sickness checks: a creature
  cannot attack or activate a tap/untap ability unless continuously controlled
  since its current controller’s most recent turn began, unless it has haste
  (CR 302.6, 508.1a). V1 exposes the effective-controller and control-start
  marks required by those callers but does not perform combat or activation
  legality.
- Expiration is query-time and deterministic. An expired effect is not folded;
  it is not silently rewritten into an indefinite effect. Missing object,
  missing source, failed duration predicate, or zone-change identity reset
  yields an explicit invalid/inactive reason.

## 5. Acceptance cases

1. A permanent entering under player A has base/effective controller A. A
   caller-ordered active effect from player B changes only the effective
   controller to B; ownership remains unchanged.
2. Two simultaneous Layer-2 effects are supplied in opposite explicit orders.
   The two results differ exactly as the supplied fold order dictates; no
   timestamp or lexical sort changes either input order.
3. A resolving effect targeting the current battlefield set does not affect a
   permanent entering later. A static effect with the same predicate does
   affect a later entrant while its source is active (CR 611.2c, 611.3a-c).
4. An indefinite effect remains active after its source leaves; a
   `while-source-exists` effect becomes inactive. If the source returns as a
   new incarnation, the historical reference does not match it (CR 400.7).
5. A `while-source-controlled` effect ends when control of its source changes;
   a `while-attached` effect ends on detachment. A source absent before the
   effect begins never starts the effect (CR 611.2b).
6. End-of-turn and beginning-of-controller-turn marks expire only at the
   recorded boundary, including a later source-controller change.
7. A control change during combat reports the effective controller change and
   the required combat-removal boundary; the control slice does not edit
   combat assignments (CR 506.4).
8. A controlled creature whose control began after the controller’s turn mark
   fails the exposed summoning-sickness predicate, while haste passes it; the
   slice does not approve an attack or tap activation (CR 302.6, 508.1a).
9. A stack spell copy is a `spell-copy` with its own stack ObjectId and
   controller; it is not cast and does not become a permanent card merely by
   sharing copied characteristics (CR 707.10). A copied ability retains its
   historical source reference (CR 707.10b).
10. A non-stack/non-battlefield object returns `null` controller; a waiting
    triggered ability uses its recorded triggering controller where applicable
    (CR 109.4, 109.4b).

## 6. Explicit DEFER / ambiguity notes

- Full CR 613 layers, sublayers, dependency graph, dependency-loop handling,
  characteristic-defining abilities, timestamp generation for every future
  object kind, and continuous-effect application are deferred. The caller’s
  explicit Layer-2 order is the only accepted order in this lane.
- Search, rule visibility, play permission, actor/selector separation,
  decision authority, command/event encoding, combat state, and actual effect
  resolution belong to the other O4P-01L lanes or later milestones.
- CR 400.7 exceptions that deliberately preserve a relation across a zone
  change must be represented by an explicit future transition adapter; V1
  must fail closed rather than infer one. LKI/history is a reference input,
  not current-object continuity.
- “Source exists” for a nonpublic or copy object, attachment identity across
  phasing/merging, and simultaneous timestamp tie-breaks require the owning
  future contracts to supply explicit identity/mark data. No name-based or
  physical-card fallback is permitted.

## 7. Exact CR references

CR 109.4-109.5; 110.2-110.5; 302.6; 400.6-400.7 (including 400.7a-b,
400.7j-k); 506.4; 508.1a; 609.1-609.4; 611.1-611.3d; 613.1-613.9
(especially 613.1b, 613.7a-b, 613.8-613.8c); 707.2-707.3 and 707.10-707.10b.

