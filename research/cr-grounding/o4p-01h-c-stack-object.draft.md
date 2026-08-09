# O4P-01H-C: Stack non-card objects and lifecycle boundary

- Status: `analyzed-not-integrated`
- Role: Domain Analyst
- Base SHA: `9ffcf64`
- Fixed authority: `rule/Magic_The_Gathering_Comprehensive_Rules.txt` (effective 2026-06-19)
- Scope: spell-copy, activated ability, triggered ability, card spell, mana ability, static ability, and delayed triggered ability.
- This is an analysis draft only. It does not authorize implementation, integration, review changes, ledger changes, or release work.

## 1. Governing distinction

CR 109.1 defines an object broadly: an ability on the stack, card, copy of a card, token, spell, permanent, or emblem. “Non-card object” therefore includes a stack ability and a spell copy, but it does not mean that every ability or effect is a stack object.

The stack contains only objects that have been put there by casting, activating, or placing a triggered ability on it (CR 405.1). The following are deliberately outside the stack:

- static abilities and the continuous, replacement, or prevention effects they generate (CR 405.6a–b, 604.1–604.2);
- state-based actions and turn-based actions (CR 405.6e–f, 704.1–704.3);
- effects themselves (CR 405.6a);
- mana abilities, including a qualifying triggered mana ability (CR 405.6c, 605.3b, 605.4a); and
- a triggered ability after it has triggered but before the next priority boundary. That is a pending runtime record, not yet a stack object (CR 109.4b, 117.2a, 603.2–603.3).

## 2. Stackable kinds and lifecycle

| Kind | Entry and runtime identity | Owner/controller rule | Source continuity and exit |
|---|---|---|---|
| Card spell | A physical card moves to the stack and becomes a spell at the start of casting (CR 112.1, 601.2a). Its characteristics come from the card, modified by applicable effects (CR 112.3). | The spell owner is the owner of its card; its controller is the player who cast/put it on the stack (CR 112.2). | It remains until resolution, countering, or another move (CR 601.2a, 112.1). An instant/sorcery spell is put into its owner’s graveyard at the end of resolution; a permanent spell becomes a permanent when resolution permits (CR 608.2n, 608.3). A card that changes zones becomes a new object, subject only to CR 400.7 exceptions. |
| Spell copy | A copy of a spell is put directly on the stack; it is a spell without an associated physical card (CR 707.10, 112.1a). | The owner is the player under whose control the copy was put on the stack; the controller is the player under whose control it was put there (CR 707.10). | It is not cast. It copies the spell’s characteristics and casting decisions, but not choices made during resolution (CR 707.10). If it leaves the stack, it ceases to exist (CR 704.5e, 707.10a); a copy of a permanent spell becomes a token permanent on resolution (CR 707.10f, 608.3f). |
| Activated ability | Activation creates a non-card ability object on top of the stack before the remaining announcement/payment steps (CR 602.2a). | The controller is the player who activated it (CR 113.8, 602.2a). CR 113.8 defines controller, not a normal card-style owner; any stored owner value is provenance/engine metadata rather than the semantic controller. | The source is the object whose ability was activated (CR 113.7). Once activated, the ability exists independently of the source; source removal does not remove it (CR 113.7a). It is removed from the stack and ceases to exist after resolution (CR 608.2n), or when an effect counters/removes it. |
| Triggered ability | The event causes the ability to trigger, but no stack action occurs immediately (CR 603.2). At the next priority boundary it becomes a non-card stack object (CR 603.3). | Before placement, its controller is the player who controlled the source when it triggered; on the stack the same rule applies, except for delayed triggered abilities (CR 109.4b, 603.3a, 113.8). | Its source is the object whose ability triggered. After it is on the stack it is independent of that source (CR 113.7, 113.7a). It ceases when removed/resolved under CR 608.2n. |
| Delayed triggered ability | Creation of the delayed ability is not stack placement. It is a future trigger definition created by resolving effects, replacement effects, or specified static-action rules (CR 603.7, 603.7a). When its event occurs, it becomes a triggered ability and follows the pending/APNAP/stack path of CR 603.2–603.3. | Source and controller are determined by how it was created: spell (603.7d), activated/triggered ability (603.7e), static replacement effect (603.7f), or static action permission (603.7g). | A delayed ability normally triggers once, unless it has a stated duration (CR 603.7b). It tracks a particular object across characteristic changes but not a new object after a zone change (CR 603.7c, 400.7). Its eventual stack object is independent of its source under CR 113.7a. |
| Mana ability | A qualifying activated mana ability resolves immediately after activation and never enters the stack (CR 605.1a, 605.3a–b). A qualifying triggered mana ability resolves immediately after the triggering mana ability, without waiting for priority (CR 605.1b, 605.4a). | Activated controller is the activator; triggered controller follows the triggered-ability rule, but neither needs a stack controller record for the no-stack resolution path. | A target disqualifies an ability from mana-ability status even if it could add mana (CR 605.5a). A spell can never be a mana ability (CR 605.5b). The transaction must not manufacture a normal stack item or pending priority trigger. |
| Static ability | A static ability is continuously true and creates a continuous/replacement/prevention effect; it never becomes a stack object (CR 604.1–604.2, 405.6b). | For “you/your” and effect application, use the current controller of the object carrying the ability, not a stack controller (CR 109.5, 604.2). | It functions only in its applicable zones, with characteristic-defining exceptions and other CR 113.6 exceptions. It is not countered by removing a stack item; its effect stops when its zone/function conditions stop applying (CR 113.6, 604.7). |

## 3. Stack membership and ordering invariant

The stack is a shared public zone (CR 400.1–400.2). Its order cannot be changed except where a rule or effect permits it (CR 400.5). Every new stack object is placed on top of the existing objects (CR 405.2); the last-added object is the top and resolves first when all players pass in succession (CR 405.5, 608.1).

The current Solo substrate represents the shared stack as `GameState.zones.stack`, ordered bottom-to-top, with entries pointing into `GameState.cards`. A physical card in that zone is a card spell. A `CardInstance` with `isAbility` is an engine representation of a non-card activated/triggered ability; `isCopy` represents a spell copy. That representation is reusable, but semantic kind must remain explicit: an engine card record for an ability does not turn the ability into a card, a spell, or an owner-controlled permanent.

The minimum stack-object identity is distinct from source identity:

- the stack item needs its own stable id for ordering, targeting, copying, resolution, undo, and removal;
- an ability needs the source physical/object identity captured at activation or trigger time; and
- a source’s later zone change must not rewrite the existing ability into the new object (CR 400.7, 113.7a).

`sourceId` alone is insufficient when the physical card leaves and returns. The current `sourceSnapshot`/`ObjectSnapshot` direction is the correct provenance boundary: retain object incarnation, owner/controller at the relevant event, face/characteristic data needed by the effect, and enough information for LKI. Do not treat the snapshot as a live permission to affect a newly incarnated object.

When multiple objects are put on the stack simultaneously, use APNAP order: active-player objects are lowest, then each nonactive player’s objects, with each controller choosing the relative order of their own objects (CR 101.4, 405.3). This is distinct from simply appending an arbitrary list.

### Zone legality and cease rules

- A card spell is legal on the stack while it is awaiting resolution; an instant or sorcery card cannot enter the battlefield (CR 400.4a), while a permanent spell can become a permanent only through the CR 608.3 path.
- An activated or triggered ability is legal as a non-card stack object only while it is on the stack. Resolution removes it and it ceases; it is not moved through card zones (CR 405.4, 608.2n).
- A spell copy is legal as a spell only on the stack. If it is moved elsewhere it ceases under CR 704.5e/707.10a, except that a copy of a permanent spell becomes a token permanent as it resolves (CR 707.10f, 608.3f).
- Static abilities, effects, SBAs, and mana abilities have no stack-zone membership to validate. A transition that models one of them as an ordinary stack item is a semantic error, not merely a UI variant (CR 405.6, 604.1, 605.3b–4a, 704.1).

## 4. Ownership, controller, source, and disappearance

CR 109.4 says only battlefield and stack objects normally have controllers, with explicit exceptions for mana abilities and pending triggered abilities. CR 109.5 gives “you/your” its controller-sensitive meaning. Therefore:

- a card spell and a spell copy always have a stack controller;
- an activated ability’s controller is its activator, regardless of later source control changes (CR 113.8);
- an ordinary triggered ability’s controller is fixed from source control at trigger time, not recalculated from the source when placed on the stack (CR 109.4b, 603.3a);
- a delayed triggered ability uses the creation-time controller rules in CR 603.7d–g; and
- a static ability uses the current controller of the carrying object and does not acquire a stack controller.

Once an activated or triggered ability is on the stack, source disappearance, destruction, or zone movement does not counter it (CR 113.7a). Resolution may still need current information or LKI: use current information while the source is in the expected public zone, otherwise LKI as specified by CR 608.2h and 113.7a. Zone-change triggers and leaves-the-battlefield triggers have their separate look-back rules (CR 400.7e–f, 603.6, 603.10a).

An ability object has no physical card to move to a graveyard. It is removed from the stack and ceases to exist after resolution (CR 608.2n). A spell copy also has no physical card and ceases outside the stack (CR 704.5e, 707.10a). In a multiplayer extension, if a player leaves, that player’s non-card stack objects cease to exist immediately (CR 800.4a); the Solo facade has no equivalent player-leaves event, but the reusable core must not encode this as a P1-only assumption.

## 5. Runtime-bearing fields and definition references

The stack item must carry only decisions and provenance that are made before or while it is on the stack; resolution-time choices remain a separate resolution boundary.

| Runtime concern | CR boundary | Required meaning |
|---|---|---|
| Source | 113.7, 113.7a, 603.7d–g, 608.2h | Source object/incarnation and creation-time controller rules; current information/LKI must be distinguishable. |
| Owner/controller | 109.4–109.5, 112.2, 113.8, 405.4, 707.10 | Spell/copy ownership differs from ability control; delayed triggers have special controller derivation. |
| Ability kind | 113.3a–d, 405.4, 605.1 | Spell ability, activated, triggered, static, and mana classification must not collapse into “stack ability.” |
| Targets | 115.1–115.3, 601.2c, 602.2b, 603.3d, 608.2b | Card-spell targets are chosen during casting; activated targets during activation; triggered targets during stack placement. Legal-target checking is repeated at resolution. |
| Modes/division | 601.2b–d, 603.3c–d, 700.2 | Mode and target-dependent division choices are stack-time choices, not resolution-time choices. |
| X and variable values | 107.3, 601.2b, 602.2b, 603.3d, 707.10 | Announced X in a spell/activation is retained; an X defined only by resolving text is chosen at its prescribed later time. Copies copy the relevant announced decisions. |
| Copy provenance | 707.2, 707.10, 707.10b–e | Copy decisions include modes, targets, X, and additional/alternative costs; a copied ability retains the original ability’s source. New targets are legal only under the copying effect’s permission. |
| Resolution body | 608.2a–n, 608.3 | Intervening-if and target legality precede effect application; resolution choices occur during resolution; an ability’s final action is removal/cease, while a spell follows its card-type destination. |

The current engine fields `sourceId`, `sourceSnapshot`, `abilityKind`, `abilityLineIndex`, `targetSelections`, `activationEnvelope`, `triggerCondition`, `abilityResolutionText`, `announcedX`, and `isCopy` are therefore runtime-bearing metadata, not a license to treat every field as applicable to every object kind. In particular, `targetSelections` may be empty because the object is untargeted; `activationEnvelope` is not valid for a triggered/static object; and `abilityResolutionText` must not be used to bypass CR 608 boundaries.

## 6. Target, mode, X, resolution, and priority boundaries

1. **Casting a card spell:** move the card to the stack; choose modes, splice, alternative/additional costs, and X; choose targets and division; check legality; lock and pay costs, activating mana abilities as permitted; then the spell becomes cast (CR 601.2a–i). Cast triggers wait until the cast is complete (CR 601.2i).
2. **Activating an ordinary ability:** create the non-card stack object, then import the relevant casting steps, including modes, targets, X, cost determination, mana-ability payment, and payment (CR 602.2a–b). A player normally needs priority (CR 117.1b).
3. **Placing a triggered ability:** triggering itself makes no stack object. At the next priority boundary, choose modes and targets, then put the ability on the stack; if a required choice is impossible or the ability is illegal, remove it instead (CR 603.2–603.4).
4. **Copying:** a copy is not cast or activated. It copies stack-time decisions, and an effect may authorize unchanged or new targets under CR 707.10c–e. Choices normally made during resolution are not copied (CR 707.10).
5. **Priority and resolution:** each priority opportunity first performs applicable SBAs to a fixed point, then places waiting triggers, then gives priority (CR 117.5). If all players pass in succession, the top object resolves (CR 117.4, 608.1). No priority is given during resolution; mana abilities may be used where the resolving effect permits, and spells explicitly cast during resolution are added on top while the current resolution continues (CR 608.2d, 608.2g).
6. **Resolution:** check intervening-if and target legality, apply instructions in order, make resolution-time choices, use APNAP where required, use current information/LKI as specified, and perform the final zone/cease action (CR 608.2a–n). A legal instant/sorcery spell or ability that leaves the stack once resolution begins continues resolving (CR 608.2m).

## 7. Pending-trigger and mana-transaction boundary

The pending-trigger record is an intermediate state, not a second stack. It must preserve at least the trigger event/group, source object/incarnation or source snapshot, controller fixed at trigger time, trigger bucket, and any intervening-if or delayed schedule data needed before placement. The current `PendingTrigger` fields (`eventId`, `simultaneousGroupId`, `sourceSnapshot`, `controllerId`, `stackPlacementBucket`, and related trigger ids) are aligned with this boundary.

At a priority boundary, multiple triggers use the two-part APNAP procedure in CR 603.3b: first ordinary triggers, then triggers whose condition is another ability triggering, followed by another SBA/trigger fixed-point check. A pending trigger must not be appended directly to the stack merely because an event occurred. This is also why an unresolved ready trigger blocks Solo phase/turn movement in the current store boundary.

Triggered mana abilities are a separate transaction-local path. A CR 605.1b trigger must not enter `GameState.pendingTriggers`, wait for priority, or be placed on the stack. It resolves immediately after the triggering mana ability and may enqueue further transaction-local mana triggers until the transaction reaches a fixed point (CR 605.1b, 605.4a). A targetful add-mana trigger, a non-mana-event add-mana trigger, or any spell remains on the ordinary stack/pending path according to CR 605.5.

Delayed triggered abilities need a separate “registered delayed definition” boundary from `PendingTrigger`: creation is not trigger placement; the definition watches for its event and only then emits one pending trigger. A phase-begin schedule can be an implementation projection, but it must retain the CR 603.7 source/controller/object-incarnation semantics and one-shot/duration behavior.

## 8. Solo stack reuse boundary

The stack lifecycle is suitable for reuse by a mode-neutral core because the stack is a shared zone and its semantics depend on object identity, controller, active-player/turn order, APNAP, priority, and source/LKI—not on a Solo UI label. The reusable boundary is:

- shared ordered stack and top-resolution rule;
- explicit player ids for spell/ability controller and delayed-trigger derivation;
- source snapshots/object incarnations independent of the Solo card display;
- pending ordinary triggers and their APNAP placement boundary; and
- no-stack treatment for static abilities, effects, SBAs, and both classes of mana abilities.

Solo remains a facade for local labels, the local player’s flattened life/mana/log projections, and the current convenience commands. The online/mode-neutral conversion must normalize `cards`, `zones`, `eventLog`, and `pendingTriggers`, while it must not move stack semantics into `localPlayerId` or assume that `P1` is always active. `pendingSbaChoices` and similar Solo interaction projections are not evidence that the stack itself is Solo-only. A future multiplayer runtime must additionally honor CR 800.4 player-leaves rules, especially immediate disappearance of non-card stack objects controlled by a leaving player.

## 9. Explicit DEFER / unresolved boundary

- Full effective-characteristics/layer evaluation for static abilities, including the complete CR 113.6 zone-function matrix and CR 604.3 characteristic-defining abilities.
- A complete discriminated runtime object model and serialization/backfill contract for every stack kind; the current `CardInstance` carrier is a substrate representation, not the final semantic type.
- Complete delayed-trigger registration, object-incarnation tracking, duration expiry, reflexive-trigger interaction, and all CR 603.7/603.12 cases.
- Complete mode grammar, target legality, variable-target/division handling, X handling, and resolution-time guided/manual coverage for the full card corpus.
- Full CR 603.3b second-bucket event production and full APNAP/priority integration across multiplayer players; existing fields and Solo ordering support are not a claim of full coverage.
- Full CR 605.1b transaction execution and loop safeguards for all triggered mana abilities; unsupported cases must remain `manual-no-stack`, never be silently routed to normal stack placement.
- Remaining SBA, replacement/prevention, LKI exception, player-specific-zone, and CR 800.4 multiplayer behavior beyond the current substrate.
- UI, review, ledger, integration, dependency, package-lock, and release work.

## CR references used

CR 101.4; 107.3; 109.1, 109.4–109.5; 112.1–112.4; 113.1–113.9; 115.1–115.3, 115.9; 117.1–117.5, 117.7; 400.1–400.7; 405.1–405.6; 601.2a–i; 602.1–602.2; 603.2–603.7, 603.10, 603.12; 604.1–604.7; 605.1–605.5; 608.1–608.3; 704.1–704.5; 707.2, 707.10–707.12; 800.4a–d.
