# O4P-01G-R Zone-Transition CR Grounding Matrix

Status: analyzed-not-integrated

This is a requirements-analysis draft for O4P-01G-R. It is not a formal specification and is not an active contract. It proposes the CR-grounded boundary for a later D decision; it does not change the engine, tests, fixtures, or runtime behavior.

## Scope

This draft isolates object movement, object incarnation, destination ownership, controller derivation, placement, visibility, and runtime reset semantics for the ordinary Commander rules path. It covers exactly 28 scenarios, ZT-01 through ZT-28.

The matrix separates these facts:

- A zone transition is not the same operation as a same-zone reorder, control change, or phasing.
- The owner of a card and the controller of a spell or permanent are independent values.
- A new object is the default result of a zone change, but the pinned CR has explicit exceptions and same-zone new-object rules.
- Entry modifiers are applied while an object is entering; they are not a substitute for the reset caused by becoming a new object.
- Visibility is a zone/property implication, not a controller or ownership result.

No product code, test, fixture, package, script, version, ledger, or protected file is changed by this draft.

## Fixed ruleset

All determinations below use only this repository-local file:

- File: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`
- Ruleset ID: `mtg-cr-2026-06-19`
- Effective date: `2026-06-19`
- Local SHA-256: `e99cd70eb64ca854acb6420ebbf06e369e3f258e0cfba4f03f70bd881386f79b`
- Pin metadata: `rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json`

No web source, latest rules file, external card database, or O4P-00B result was used. Rule numbers in this document refer to the pinned local text.

## Terminology

- **Object**: the game object currently in a zone or on the battlefield. A physical card can represent successive objects after zone changes; a token and a spell copy can also be objects under the CR.
- **Incarnation**: descriptive analysis shorthand for one object identity in one existence. This word is not proposed as a public API name.
- **Zone transition**: an object moving from one zone to another. The ordinary rule is CR 400.7.
- **Same-zone new object**: a CR 400.8, 400.9, or 400.10 event can make a new object even though the zone does not change; this is distinct from a zone transition.
- **Owner**: for a card, the player who started the game with it in their deck or who otherwise owns it under the game rules. CR 400.3 routes a card entering a library, graveyard, or hand to its owner’s corresponding zone.
- **Controller**: the player who controls a spell, ability, or permanent. A spell’s controller is the player who cast it (CR 405.4); a permanent’s default controller is the player under whose control it entered (CR 110.2).
- **Public zone**: graveyard, battlefield, stack, exile, command, and other public zones named by CR 400.2. Library and hand are hidden zones even when cards happen to be revealed.
- **Placement**: the order or pile position required by the destination zone. It is not a new object rule by itself.
- **Runtime reset**: the fields that stop belonging to the old object when a new object is created. Entry modifiers are recorded separately.

## Zone-transition rule matrix

The matrix has exactly 28 scenario rows. `AUTOMATIC_V1` means the basic transition rule is deterministic enough to be a candidate for a first automatic substrate; it does not mean current product code already implements it. `EXPLICIT_MODIFIER_LATER` means the base transition is clear but requires an explicit modifier/event record before automation. `NOT_ZONE_TRANSITION` means the scenario is intentionally not represented as an ordinary zone-change command. `DEFER` means the rule boundary is known but this D slice must not claim an automatic implementation.

| Scenario ID | Source zone | Destination zone | Governing CR | Destination player derivation | Base controller result | New object required | Incarnation action | Runtime reset | Placement | Visibility implication | MVP classification | Required test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ZT-01 library->hand draw | A’s library | A’s hand | 121.1, 121.2, 400.3, 402.1 | A is the affected library player; hand is A’s hand | No controller in hand; owner remains A | Yes, 400.7 | Create the hand incarnation after the top card leaves the library | No permanent status, counters, or old-zone runtime state exists in hand | Remove the top card; hand order is freely arranged under 402.3 | Hand is hidden under 400.2 and 402.3 | AUTOMATIC_V1 | `zt-01-library-hand-draw` | A library-to-hand effect without “draw” is still a move but is not a draw under 121.5. |
| ZT-02 library->graveyard mill | A’s library | A’s graveyard | 701.17a-c, 400.3, 404.1 | Each card goes to its owner’s graveyard | No battlefield controller; owner remains the card owner | Yes, 400.7 | Create one graveyard incarnation per milled card | Old counters, status, attachments, and hidden-zone runtime do not carry | Cards go on top; simultaneous cards may be arranged under 404.3 | Graveyard is public and face up under 404.2 | AUTOMATIC_V1 | `zt-02-library-graveyard-mill` | 701.17c permits the effect to find the public milled object; that is tracking, not old-object identity. |
| ZT-03 hand->stack cast | A’s hand | Shared stack | 601.2a-i, 405.1, 405.4, 400.7g-h | Stack is shared; owner remains A | The player who casts the card becomes spell controller | Yes, 601.2a and 400.7 | Replace the hand incarnation with the stack spell object and record cast choices | Hand state ends; stack characteristics and choices are established; no permanent status exists | Put the spell on top under 405.2 | Stack is public; hidden-zone information is handled by 601.2 | AUTOMATIC_V1 | `zt-03-hand-stack-cast` | Casting from a permitted non-hand zone is a separate permission modifier; this row is specifically hand to stack. |
| ZT-04 stack->battlefield permanent resolution | Stack | Shared battlefield | 608.3a-e, 110.2, 110.5, 400.7a-d | Battlefield is shared; no destination player | Normally the spell controller controls the permanent; 110.2b is the specific gained-permanent-spell exception | Yes, 608.3 creates the permanent object | Resolve the spell into a battlefield incarnation and carry only listed 400.7a-d relations | Entry defaults to untapped, unflipped, face up, phased in under 110.5b; entry modifiers are separate | Battlefield has no intrinsic order; attachments/control remain clear | Battlefield is public under 400.2 | AUTOMATIC_V1 | `zt-04-stack-battlefield-permanent-resolution` | Illegal-target and unable-to-enter branches follow 608.3b-e. |
| ZT-05 stack->owner graveyard instant/sorcery | Stack | Spell owner’s graveyard | 608.2m-n, 404.1, 400.3 | The spell owner’s graveyard receives the finished spell | Resolving controller controls the effect until final placement; it does not become the graveyard owner | Yes, 608.2n | Finish resolution, then create the owner-graveyard incarnation | Stack-only choices and spell state end; no permanent status exists in graveyard | Put the card on top of its owner’s graveyard | Graveyard is public and face up under 404.2 | AUTOMATIC_V1 | `zt-05-stack-owner-graveyard-instant-sorcery` | The same ordinary final placement covers both instant and sorcery spells. |
| ZT-06 battlefield->owner graveyard | Battlefield | Permanent owner’s graveyard | 704.5f, 704.5j, 400.3, 400.6, 404.1 | Card owner’s graveyard, after applicable replacement effects | Current controller does not determine the graveyard destination | Yes, 400.7 | Apply replacements, then create the graveyard incarnation | Old control, counters, status, attachments, combat, and continuous effects reset | Put the card on top; simultaneous cards use 404.3 | Graveyard is public; applicable 400.7e tracking is separate | AUTOMATIC_V1 | `zt-06-battlefield-owner-graveyard` | This is the ordinary owner route; the explicit owner/controller divergence case is ZT-15. |
| ZT-07 battlefield->owner hand | Battlefield | Permanent owner’s hand | 400.3, 400.6, 400.7, 402.1 | Card owner’s hand | No controller in hand; current controller does not route the card | Yes, 400.7 | Apply replacements, then create the owner-hand incarnation | Permanent status, counters, attachments, and battlefield effects reset | Hand placement is not ordered by the battlefield | Hand is hidden under 400.2 and 402.3 | AUTOMATIC_V1 | `zt-07-battlefield-owner-hand` | The effect may be subject to Commander 903.9b or another replacement; this row is the base owner route. |
| ZT-08 battlefield->owner library top | Battlefield | Permanent owner’s library, top | 400.3, 400.5, 400.7, 401.2, 401.4 | Card owner’s library | No controller in library; current controller does not route the card | Yes, 400.7 | Create the owner-library incarnation and apply top placement | Permanent runtime resets; no status/counters/attachments exist in library | Put on top; simultaneous cards may be arranged by their owner under 401.4 | Library is hidden under 401.2 | AUTOMATIC_V1 | `zt-08-battlefield-owner-library-top` | Top placement is a destination placement, not a same-zone reorder. |
| ZT-09 battlefield->owner library bottom | Battlefield | Permanent owner’s library, bottom | 400.3, 400.5, 400.7, 401.4, 401.7 | Card owner’s library | No controller in library | Yes, 400.7 | Create the owner-library incarnation and apply bottom placement | Permanent runtime resets | Put on bottom; an impossible Nth-from-top instruction falls back under 401.7 | Library remains hidden | AUTOMATIC_V1 | `zt-09-battlefield-owner-library-bottom` | Owner ordering for simultaneous cards remains distinct from the bottom destination itself. |
| ZT-10 any zone->exile | Any zone | Shared exile | 701.13a, 400.6, 400.7, 406.1-406.3 | Exile is shared; owner remains the card owner | No default controller in exile; later permission is explicit | Yes, 400.7 | Create an exile incarnation and record only explicit return/link metadata | Old counters, status, attachments, and battlefield runtime reset | Exile grouping follows 406.4-406.5 | Face up and examinable by default under 406.3; face down is a modifier | AUTOMATIC_V1 | `zt-10-any-zone-exile` | Re-exiling an object already in exile is the special same-zone new-object case in 400.8. |
| ZT-11 exile->stack | Exile | Shared stack | 406.3a-b, 601.2a-i, 601.3f, 400.7g-h, 405.1 | Stack is shared; the card owner remains its owner | The player permitted to cast it becomes spell controller | Yes, 400.7 | Apply the cast-from-exile permission, then create the stack spell incarnation | Exile visibility/permission ends or changes as casting begins; spell choices are new | Put the spell on top under 405.2 | Face-down exile may be looked at only as allowed; the resulting spell is governed by 601.3f | EXPLICIT_MODIFIER_LATER | `zt-11-exile-stack-permitted-cast` | The transition is clear, but cast permission, face-down selection, and reveal timing require an explicit modifier. |
| ZT-12 exile->battlefield | Exile | Shared battlefield | 110.2a, 400.6, 400.7, 608.2c | Battlefield is shared; no destination player | The effect’s specified player controls the entering permanent; 110.2a supplies the default instruction rule | Yes, 400.7 | Create the battlefield incarnation after replacements and entry choices | Entry status defaults under 110.5b; entry modifiers are applied to the new object | No intrinsic battlefield order | Battlefield is public | AUTOMATIC_V1 | `zt-12-exile-battlefield-return` | “Under its owner’s control” is explicit and must not be inferred from the old exile permission holder. |
| ZT-13 any zone->command | Any allowed source | Shared command zone | 400.1, 400.6, 400.7, 400.10, 903.9 | Command is shared; no player-specific command zone | No default controller in command; ownership and designation remain separate | Yes for a real move; 400.10 also creates a new object for command-to-command | Bump incarnation on the move or 400.10 same-zone event | Zone-specific runtime resets; Commander designation is governed by 903.3 | Command has no default library/graveyard ordering | Command is public under 400.2 | EXPLICIT_MODIFIER_LATER | `zt-13-any-zone-command` | This is the base command route; Commander replacement is ZT-23 and command casting is ZT-14. |
| ZT-14 command->stack | Command | Shared stack | 903.8, 601.2a-i, 405.1, 405.4, 400.7 | Stack is shared; owner remains the commander’s owner | The player who casts the commander controls the spell | Yes, 400.7 | Create the stack spell incarnation and apply commander-cast cost modifiers | Command-zone runtime ends; cast choices and tax are spell/cost data, not old-object memory | Put the spell on top under 405.2 | Command is public; stack is public | EXPLICIT_MODIFIER_LATER | `zt-14-command-stack-cast` | Commander tax and permission are separate from the ordinary card-to-stack object transition. |
| ZT-15 owner/controller-divergent permanent death | Battlefield permanent owned by A, controlled by B | A’s graveyard | 110.2, 400.3, 400.6, 404.1, 704.5f | Destination player is owner A, not controller B | B’s control does not alter owner routing; the graveyard object has no battlefield controller | Yes, 400.7 | Apply replacements and create A’s graveyard incarnation | B’s control, counters, status, attachments, combat, and continuous effects reset | Put on A’s graveyard top | Graveyard is public | AUTOMATIC_V1 | `zt-15-owner-controller-divergent-permanent-death` | This row is distinct from the ordinary battlefield death row because owner/controller divergence is the acceptance condition. |
| ZT-16 owner/controller-divergent spell resolution/counter | Stack spell owned by A, controlled by B | A’s graveyard | 405.4, 608.2n, 701.6a, 400.3, 404.1 | Destination player is spell owner A | B controls resolution/countering; ownership routes the ordinary graveyard destination | Yes, 400.7 | Resolve or counter, then create A’s graveyard incarnation unless a replacement changes it | Stack targets, choices, and spell state reset; B is not inherited as graveyard controller | Put on A’s graveyard top | Graveyard is public | AUTOMATIC_V1 | `zt-16-owner-controller-divergent-spell-resolution-counter` | A spell copy is deliberately excluded and is ZT-25. |
| ZT-17 library reorder | Library | Same library | 400.5, 401.2, 401.4, 401.6, 401.7, 701.22a, 701.25a | None; no destination zone | No controller change | No ordinary transition; 401.6 can make a revealed card a new object | Apply only the permitted reorder and explicit revealed-card incarnation rule | No blanket runtime reset | Apply top/bottom/in-order placement allowed by the effect | Hidden library remains hidden; revealed cards follow 401.6 | NOT_ZONE_TRANSITION | `zt-17-library-reorder` | Scry/surveil may also move cards; this row is only the same-library reorder portion. |
| ZT-18 library shuffle | Library | Same library | 400.12, 401.2, 701.20d, 701.22, 701.25 | None; the zone is not replaced | No controller change | No ordinary transition; a reordered revealed card becomes a new object under 701.20d | Shuffle order and apply only the explicit revealed-card reset | No blanket reset for every library card | Randomize library order under the effect | Reordered revealed cards stop being revealed; other cards remain hidden | NOT_ZONE_TRANSITION | `zt-18-library-shuffle` | 400.12 acts on the cards and does not replace the zone. |
| ZT-19 same-zone reorder | Library, graveyard, stack, or face-down pile | Same zone or pile | 400.5, 401.2, 404.2-404.3, 405.2-405.3 | None | No owner/controller derivation | No ordinary transition, except explicit 401.6 or 400.8-400.10 cases | Change only permitted order/pile placement | No generic runtime reset | Preserve the zone’s ordering rules; do not use a hidden temporary zone | Visibility follows the zone and face-down-pile rule | NOT_ZONE_TRANSITION | `zt-19-same-zone-reorder` | Same-zone order is not a zone-change command. |
| ZT-20 battlefield control change | Battlefield permanent | Same battlefield | 110.2, 110.2a-b, 400.5, 611, 506.4 | None; no destination player | The specified player becomes controller while the object remains the same | No | Apply the control-changing effect without an incarnation bump | Counters, status, attachments, and continuous effects remain unless another rule changes them | No placement change | Battlefield remains public | NOT_ZONE_TRANSITION | `zt-20-battlefield-control-change` | Control change is not ownership change or zone change. |
| ZT-21 phasing | Battlefield | Battlefield, phased out/in status | 110.5, 702.26a-d, 702.26g-j | None | Controller does not change by phasing | No | Toggle phased status on the same object | Counters and stickers remain; indirect attachments phase with it; no zone-change trigger | No placement change | Phased-out permanent is treated as nonexistent except where rules mention it | NOT_ZONE_TRANSITION | `zt-21-phasing` | 702.26d expressly denies zone and control change. |
| ZT-22 face-down exile | Any zone | Shared exile, face down | 406.3-406.5, 400.7, 712.17, 708.9 | Exile is shared; card owner remains owner | No default controller; play/cast permission is explicit | Yes, 400.7 | Create a face-down exile incarnation and record only authorized viewer/pile metadata | Old runtime resets; exile face-down is not permanent face-down status under 110.5d | Separate piles by when/how exiled under 406.4-406.5 | No examination by default; no characteristics under 406.3a; authorized look is retained as allowed | EXPLICIT_MODIFIER_LATER | `zt-22-face-down-exile` | Visibility, pile identity, and later play/cast permissions are separate modifiers. |
| ZT-23 commander replacement | Graveyard/exile after SBA, or hand/library before the move | Shared command zone, replacing or following the event | 903.3, 903.9a-c, 400.6-400.7, 614.5 | Commander owner makes the choice; command is shared | No controller is derived in command; designation remains a card attribute | Yes for each actual move; 903.9b replaces hand/library placement and 903.9a follows graveyard/exile placement | Apply the correct timing; split melded/merged components under 903.9c | Ordinary old-object runtime resets; designation/cast history are not ordinary characteristics | Command has no library/graveyard ordering; components use 903.9c | Command is public; source-event visibility remains relevant | EXPLICIT_MODIFIER_LATER | `zt-23-commander-replacement` | 903.9a, b, and c are separate paths; 903.9b may apply more than once. |
| ZT-24 token zone change | Battlefield token | Effect-specified nonbattlefield zone, then cease to exist | 111.7-111.8, 400.7, 400.5, 704 | Destination follows the zone-change event; token owner is its creator under 111.2, but it is not a card-owner route | Token has its existing controller during the move; no reusable controller exists after it ceases | Yes for the move; the token then ceases under 111.7 | Create the destination token incarnation only long enough for applicable triggers/state actions; stop further movement | Battlefield status/counters reset on the move; token ceases outside battlefield and cannot return | Apply the event’s placement before state-based existence handling | Applicable triggers occur before the token ceases; nonbattlefield token visibility is not a persistent card identity | EXPLICIT_MODIFIER_LATER | `zt-24-token-zone-change` | Token creation is not this scenario. 111.8 forbids a token that has left the battlefield from moving again or returning. |
| ZT-25 spell copy leaving stack | Shared stack | Non-stack zone momentarily, then cease to exist | 405.1, 405.2, 707.2, 707.10-707.10a | No persistent destination player; copy owner/controller are assigned on the stack under 707.10 | Copy controller is the player who put it on the stack; it was not cast | No card incarnation; the copy ceases if it leaves the stack | Apply copy values/choices, then remove the transient copy rather than creating a persistent card object | Copy has no card counters/status/physical identity to reset | Stack top while present | Stack is public; it cannot remain a hidden-zone card copy | NOT_ZONE_TRANSITION | `zt-25-spell-copy-leaving-stack` | This is a copy-object lifetime boundary, not ordinary card movement. |
| ZT-26 merged/melded object | Battlefield plus merge component, or meld-pair objects | Shared battlefield composite, then component destinations on exit | 730.2-730.3, 701.42, 712.4, 712.21, 400.7, 903.3b, 903.9c | Component owners route cards to their appropriate zones; battlefield is shared | Merge preserves the pre-merge permanent object/controller; meld creates one combined permanent with controller from the event | Merge: component joins the existing object and is not an ETB; meld: two cards become one represented object, then split on exit | Apply component-aware identity and exit rules; do not use a one-card shortcut | Merge preserves the existing permanent’s relevant runtime; melded/merged exit creates destination component objects | Graveyard/library ordering and exile timestamps follow 730.3 and 712.21 | Battlefield is public; component face/visibility rules apply on exit | EXPLICIT_MODIFIER_LATER | `zt-26-merged-melded-object` | Merged boundary: 730.2b-c says the result is the same object and has not just entered. Melded boundary: 712.21 says one permanent leaves but two cards move, with 903.9c for a commander. |
| ZT-27 counter-retention exception | Any source zone | Any different destination zone | 122.1-122.2, 122.6, 400.7, 614.12 | Destination derives from the underlying move | Controller derives from the destination rule; counters never establish owner/controller | Yes for a zone change | Drop old counters with the old object; apply only counters specified for entry | Counters cease under 122.2; entry counters are a new modifier under 122.6 | Placement follows the underlying zone | Visibility follows the underlying destination | AUTOMATIC_V1 | `zt-27-counter-retention-exception` | The exception is that counters are not retained; entry counters are not carried counters. |
| ZT-28 CR 400.7 previous-object tracking exceptions | Varies by the listed exception | Stack, battlefield, or public destination named by the listed exception | 400.7a-m, 400.8-400.10, 401.6, 701.20d | Derived by the specific cast/play/effect/replacement event; 400.3 still controls owner-routed zones | Controller follows the specific event; only the listed relation survives the new-object boundary | Yes for each real move, with 400.8-400.10 and 401.6/701.20d same-zone exceptions | Allocate the new object, then attach only the typed relation allowed by the applicable 400.7 subrule | Default reset applies; no general old-object memory | Placement follows the event and its destination-zone rules | Public-zone predicates, face-down rules, linked abilities, madness, and stickers are distinct visibility/tracking inputs | DEFER | `zt-28-cr-400-7-previous-object-tracking` | Full 400.7a-m inventory is section 9. This one row is the required tracking-exception scenario; no subrule is silently folded into an earlier broad movement row. |

**Matrix count: 28 scenarios exactly.** No other row is implied by a compound label; ZT-05 intentionally covers both instant and sorcery resolution because the pinned rules give them the same ordinary final placement in 608.2n.

## Same-zone operations

Same-zone operations must not be encoded as ordinary `sourceZone !== destinationZone` movements:

1. Library reorder is controlled by 400.5, 401.2, 401.4, 401.6, 401.7 and effect-specific actions such as scry/surveil. The order changes, but the library remains the same zone.
2. Shuffle acts on the cards in the zone; 400.12 says the zone itself is not affected. A revealed card that is reordered becomes a new object under 701.20d, but that is an explicit visibility/incarnation rule, not a blanket reset of every library card.
3. Graveyard order is normally fixed by 404.2; simultaneous insertion permits owner ordering under 404.3. Stack order is governed by 405.2-405.3. Neither is a generic free reorder.
4. Putting an object into the zone it already occupies is a special new-object event under 400.8 for exile and 400.10 for command. Turning a face-up command object face down is a new object under 400.9. These events have no ordinary source/destination zone delta but do require an incarnation bump.
5. Control change is a continuous-effect/state operation under 110.2 and 611, not a zone transition. Phasing is a status operation under 702.26 and expressly does not change zone or control.

## Owner and controller

The destination and controller calculations must be separate:

- CR 400.3 routes an object going to a library, graveyard, or hand to its owner’s corresponding zone. This remains true if another player controls the object.
- CR 110.2 defines a permanent’s owner from the representing card and gives the default controller as the player under whose control it entered. CR 110.2a supplies the default when an effect instructs a player to put an object onto the battlefield; 110.2b is the specific permanent-spell control exception.
- CR 405.4 defines a spell’s controller as the player who cast it, while its ordinary graveyard destination is still its owner’s graveyard under 400.3 and 404.1.
- A control-changing effect changes control without changing ownership or creating a new object (ZT-20). A zone change creates a new object and therefore cannot infer old controller state except where a listed CR exception or the new entry effect supplies it.
- For a token, the creator is both owner and entering controller under 111.2. That is a creation rule, not a card-owner derivation.

The minimum integration invariant is therefore `destinationOwner != currentController` as a supported state, with independent assertions for both values. Any implementation that derives destination zone from controller, or derives new controller from card owner without an entry instruction, violates the pinned rules.

## New-object and incarnation rules

The ordinary transition procedure is:

1. Identify the event and apply replacement effects under 400.6 and the applicable replacement-effect rules.
2. Move the object and allocate the new object described by 400.7.
3. Derive destination ownership from 400.3 where applicable and derive controller from the destination rule/effect, not from old-object memory.
4. Apply entry modifiers and entry choices after the destination object is determined. CR 614.12 and 122.6 describe entry-time replacement/counter handling; they do not negate 400.7.
5. Emit only the explicitly allowed relation metadata for a 400.7 exception, linked ability, public-zone tracker, or same-zone new-object rule.

The default new object has no memory or relation to the old existence. The following are the required exceptions or special cases:

- 400.7a-d: listed spell-to-permanent continuities.
- 400.7e-f: specified public-zone trigger/Aura finding.
- 400.7g-i: cast/play permission continuity.
- 400.7j: public-zone finding by the same effect or cost.
- 400.7k: the specified post-madness public-zone follow-through.
- 400.7m: stickers and their effects between public zones.
- 400.8: an object exiled while already in exile is a new object without changing zones.
- 400.9: a face-up command object turned face down is a new object.
- 400.10: an object put into command while already in command is a new object without changing zones.
- 401.6 and 701.20d: revealed library cards that stop being revealed or are reordered can become new objects under their specific rules.
- 730.2b-c: a merge component leaves its previous zone but the resulting merged permanent remains the same object and is not considered to have just entered.
- 712.21 and 730.3: melded/merged permanents leave as one permanent while their component cards become separate destination objects.

## Runtime reset matrix

This matrix distinguishes object reset from entry modifiers and from operations that intentionally preserve the same object.

| Runtime concern | Ordinary zone change / 400.7 | Battlefield entry | Same-zone new object | Control change | Phasing |
|---|---|---|---|---|---|
| Object identity | New object with no old memory | New object is already established before entry modifiers | New object under 400.8-400.10 or the specific 401.6/701.20d rule | Preserved | Preserved |
| Owner | Card owner remains the card owner; destination library/hand/graveyard uses 400.3 | Card owner remains; controller is separately derived | Preserved as a card attribute | Preserved | Preserved |
| Controller | Not inherited unless a listed exception/effect supplies it | 110.2/110.2a-b and the effect derive it | No old controller memory unless the specific rule says otherwise | Changed by the continuous effect | Not changed by phasing |
| Counters | Cease to exist under 122.2 | Only counters specified by an entry effect are present under 122.6 | Old counters cease; new object can receive new ones | Remain | Remain under 702.26d |
| Tapped/flipped/face-up/phased status | No old permanent status carries; nonbattlefield cards have no permanent status under 110.5d | Defaults to untapped, unflipped, face up, phased in under 110.5b unless an effect says otherwise | Reset according to the new object’s zone/rule | Remains unless another effect changes it | Phased status toggles; it is not a zone reset |
| Attachments/combat | Old attachment/combat relation does not carry generically | Entry attachment is an explicit effect/replacement result | No generic relation carries | Attachments remain subject to legality; combat has 506.4 consequences only when applicable | Indirectly attached Auras/Equipment/Fortifications phase with the permanent under 702.26g-i |
| Continuous effects | End unless a specific 400.7 or other CR exception applies | Apply existing and entry-generated effects under their own rules | End unless the specific rule preserves them | Continue/change under 611 | May expire while phased out under 702.26f |
| Visibility | Follows destination zone and face-down modifier | Follows battlefield public status | Follows the same-zone rule | Unchanged by control alone | Phased-out treatment is existence/status, not hidden-zone visibility |
| Entry modifiers | Not a reset field | Applied during the entry event (614.12); do not confuse with old-state carry | Apply only if the same-zone rule/effect says so | Not applicable merely because control changed | Not an entry event |

## CR 400.7 exception inventory

The local pinned text enumerates the following exception inventory. The inventory is intentionally explicit; no unlisted “remember the old object” behavior is inferred.

| Rule | Fixed CR relation | Matrix consumer | D boundary |
|---|---|---|---|
| 400.7a | Effects from spells, activated abilities, and triggered abilities that change the characteristics or controller of a permanent spell continue to apply to the permanent it becomes | ZT-28 | Type the carried effect; do not preserve all spell state |
| 400.7b | Static abilities granting an ability to a permanent spell that functions on the battlefield continue to apply to the permanent it becomes | ZT-28 | Requires a battlefield-functioning static-ability relation |
| 400.7c | Prevention effects applying to damage from a permanent spell continue to apply to the permanent it becomes | ZT-28 | Requires an explicit prevention relation |
| 400.7d | A permanent can reference information about the spell that became it, including costs paid or mana spent | ZT-28 | Track only the information requested by the ability; no general history |
| 400.7e | A zone-change trigger can find the new public-zone object it became when the ability triggered | ZT-28 | Requires a zone-change event/new-object link and public-zone proof |
| 400.7f | A trigger from an enchanted permanent leaving can find the new Aura objects in their owner’s graveyards in the specified simultaneous/SBA cases | ZT-28 | Do not generalize to arbitrary attachments or hidden destinations |
| 400.7g | A granted permission to cast a nonland card continues to apply to the new object after it moves to the stack by that permission | ZT-28 | Requires cast-permission provenance |
| 400.7h | Other parts of an effect allowing a nonland card to be cast can find the new stack object | ZT-28 | Requires same-effect linkage; not name-only tracking |
| 400.7i | Other parts of an effect allowing a land card to be played can find the new battlefield object | ZT-28 | Requires play-permission provenance and land-play boundary |
| 400.7j | An effect or cost that moves an object to a public zone can find that moved public-zone object | ZT-28 | Requires event identity, public-zone check, and effect/cost identity |
| 400.7k | After a madness triggered ability resolves, a specified public-zone move of the uncast exiled card can still be found | ZT-28 | Madness-specific flow is DEFER for D; do not treat as generic exile tracking |
| 400.7m | Stickers on an object in a public zone are retained as it moves to another public zone and their effects continue | ZT-28 | Sticker state is DEFER for D; do not silently drop or invent sticker data |

The absence of a 400.7l entry in the pinned local text is preserved; this draft does not invent one. The base of 400.7 remains “new object with no memory,” and the rows above are exceptions to that base, not replacements for it.

## Commander-related boundary

Commander status is a card attribute that remains with the card as it changes zones (903.3); it is not a characteristic and must not be erased by an ordinary incarnation reset. The following boundaries are fixed:

- A commander cast from the command zone is an ordinary cast transition to the stack under 903.8 plus 601.2. The commander tax is a cost modifier, not an alternative object identity.
- If a commander is in a graveyard or exile after it was put there since the last state-based-action check, its owner may put it into the command zone as a state-based action under 903.9a. This is a subsequent move, not the same replacement timing as 903.9b.
- If a commander would be put into its owner’s hand or library, its owner may replace that event with a move to the command zone under 903.9b. The replacement can apply more than once to the same event.
- If a commander is a melded or merged permanent and 903.9b is used, 903.9c determines how the commander-representing card and other components are put into their appropriate zones. This is not a single-card shortcut.
- 903.3b and 903.3c keep the commander designation attached to the appropriate melded/merged result. The designation does not make the resulting object immune to 400.7 or the component rules.
- The command zone is public and shared under 400.1-400.2. “The owner’s command zone” is therefore a routing description for the owner’s commander choice, not a separate per-player zone.

The D slice must not merge commander replacement choice, commander cast count, owner routing, controller routing, and component splitting into one generic `toCommand` flag.

## Token/copy/ability boundary

- Token creation is a creation operation under 111.1-111.4, not movement of a card from a source zone. The creator owns and controls the token on entry under 111.2.
- A token in a non-battlefield zone ceases to exist as a state-based action under 111.7. A token that has left the battlefield cannot move to another zone or return under 111.8. Triggers can observe the first move before the token ceases to exist.
- A spell copy is put onto the stack, is not cast, and has the owner/controller determined by 707.10. It is a stack object without an associated physical card and ceases to exist if it leaves the stack under 707.10a.
- A copy of a permanent spell becomes a token permanent as it resolves under 608.3f and 707.10f. It is not “created” for rules that refer specifically to creating a token; this is a copy-resolution boundary, not ordinary token creation.
- An activated or triggered ability on the stack has no card associated with it under 405.1. Its source/controller and last-known-information questions use the ability rules and 608.2h, not a fabricated card zone transition.
- Copying does not copy status, counters, or stickers under 707.2. A copy effect and a zone transition are independent dimensions.

## Required integration tests

These are requirements for a later integration slice; none are added by this task. Each test must assert the final object/zone result, owner, controller, incarnation behavior, placement, visibility, and reset fields relevant to its row.

1. `zt-01-library-hand-draw`: draw the top card and distinguish draw from a non-draw library-to-hand move under 121.5.
2. `zt-02-library-graveyard-mill`: mill to the owner’s graveyard and allow the same effect to find the public milled object.
3. `zt-03-hand-stack-cast`: cast a card from hand and assert owner/controller divergence.
4. `zt-04-stack-battlefield-permanent-resolution`: resolve a permanent spell with default and explicit controller/entry modifiers.
5. `zt-05-stack-owner-graveyard-instant-sorcery`: resolve both spell types and verify owner-graveyard final placement.
6. `zt-06-battlefield-owner-graveyard`: move a permanent to its owner’s graveyard through the ordinary death route.
7. `zt-07-battlefield-owner-hand`: move a permanent to its owner’s hand with replacement-effect boundary coverage.
8. `zt-08-battlefield-owner-library-top`: move a permanent to its owner’s library top.
9. `zt-09-battlefield-owner-library-bottom`: move a permanent to its owner’s library bottom and cover 401.7 fallback.
10. `zt-10-any-zone-exile`: exile an object and verify the new public default object.
11. `zt-11-exile-stack-permitted-cast`: cast from exile with permission, face-down selection, and reveal timing.
12. `zt-12-exile-battlefield-return`: return from exile with owner/nonowner control instructions.
13. `zt-13-any-zone-command`: route an allowed object to command and cover 400.10.
14. `zt-14-command-stack-cast`: cast a commander from command and separate tax from identity.
15. `zt-15-owner-controller-divergent-permanent-death`: permanent owned by A and controlled by B reaches A’s graveyard.
16. `zt-16-owner-controller-divergent-spell-resolution-counter`: spell owned by A and controlled by B resolves/counters to A’s graveyard.
17. `zt-17-library-reorder`: reorder library cards and verify only explicit revealed-card incarnation rules.
18. `zt-18-library-shuffle`: shuffle the library and verify revealed-card handling without a blanket reset.
19. `zt-19-same-zone-reorder`: reorder library/graveyard/stack/piles without a generic zone-change command.
20. `zt-20-battlefield-control-change`: change control while preserving object identity and runtime state.
21. `zt-21-phasing`: phase out/in without a zone change, reset, or zone-change trigger.
22. `zt-22-face-down-exile`: verify hidden characteristics, authorized viewer, pile identity, and later permission.
23. `zt-23-commander-replacement`: exercise 903.9a, 903.9b, repeated replacement, and 903.9c components.
24. `zt-24-token-zone-change`: move a battlefield token once, observe triggers, then apply 111.7-111.8.
25. `zt-25-spell-copy-leaving-stack`: copy a spell, verify no cast, then verify ceasing outside the stack.
26. `zt-26-merged-melded-object`: test both merged same-object and melded two-card exit boundaries.
27. `zt-27-counter-retention-exception`: move a counter-bearing object and separately add counters on entry.
28. `zt-28-cr-400-7-previous-object-tracking`: test the full section 9 exception inventory with fail-closed DEFER/manual behavior.

## Unresolved contradictions

The pinned CR resolves the apparent conflicts below. These are not grounds for inventing a new general rule:

| Apparent conflict | Fixed CR resolution | D boundary |
|---|---|---|
| Owner routes a destination, while another player controls the object | 400.3/404.1 route the card to its owner’s corresponding zone; 110.2 and 405.4 separately define controller | Keep owner and controller as independent fields |
| 400.7 says “new object,” while 400.7a-m preserve specific relations | New object is the base; only the enumerated relation survives | Use typed exception metadata, never a generic old-state copy |
| A same-zone action seems not to be a move, but 400.8-400.10 create new objects | The zone does not change, but the specified rule still creates a new object | Track `zoneChanged` and `incarnationChanged` independently |
| Face-down exile resembles face-down permanent status | 406.3/406.3a govern exile visibility and characteristics; 110.5d says nonbattlefield cards have no permanent face-down status | Keep exile visibility separate from permanent status |
| Phasing makes a permanent disappear, but no zone trigger occurs | 702.26b-d explicitly preserve the object and deny zone/control change | Do not implement phasing as exile/return |
| Commander graveyard/exile choice differs from hand/library replacement | 903.9a is a state-based-action choice after the object is in graveyard/exile; 903.9b is a replacement before hand/library placement | Preserve event timing and permit repeated 903.9b application |
| Tokens can trigger when leaving but then cease to exist | 111.7 says triggers happen before the token ceases; 111.8 prevents subsequent movement/return | Do not model token disappearance as an ordinary reusable card |
| Merged and melded permanents are represented by multiple components | 730.3 and 712.21 distinguish one permanent/object from multiple cards on exit; 730.2c separately preserves a merged object through the merge | Require component-aware handling; no one-card shortcut |
| Old counters versus counters on entry | 122.2 removes old counters as the object changes zones; 122.6 permits new entry counters | Reset first, then apply entry modifier |
| Reordering a revealed library card sometimes creates a new object | 401.6 and 701.20d provide the explicit revealed-card cases; 400.5 alone does not | Generic reorder/shuffle tracking is DEFER unless the reveal history is explicit |

No contradiction remains in the listed CR rules after these resolutions. The unresolved items are product-boundary questions, not CR ambiguities: generic event-link storage for 400.7j, madness-specific flow for 400.7k, sticker state for 400.7m, merged/melded component storage, face-down exile pile/viewer history, and the existing runtime’s representation of incarnation identity. Those are explicitly deferred below.

## DEFER

The following boundaries are DEFER for D and must not be reported as `AUTOMATIC_V1`:

- Generic effect/cost tracking for all 400.7 exceptions. Each exception needs its own event relation and public-zone predicate; a physical-card ID alone is insufficient.
- 400.7k madness flow, including the exact post-resolution public-zone route.
- 400.7m stickers and sticker effects, because no sticker state may be invented by this requirements draft.
- Face-down exile pile identity, authorized viewer history, and cast/play permissions beyond the fixed 406.3-406.5 boundary.
- Commander replacement as a single generic command route; 903.9a, 903.9b, 903.9c, 903.8, and commander designation must remain separate.
- Merged and melded permanent integration, including component ownership, one-object/two-card counting, replacement effects, and commander component routing.
- Token/copy/ability conflation. Token creation, a copy of a spell, a copy of a permanent spell, and an ability object are different CR objects.
- Any counter-retention behavior across a zone change. Only entry counters defined by a new event may appear.
- Any use of controller as a substitute for owner when routing to hand, library, or graveyard.
- Any implementation claim based only on syntax or a single card fixture without an executable final-state replay.

Status remains **analyzed-not-integrated**. This draft contains exactly 28 scenarios and makes no product-code or test claim beyond the required future integration vectors above.
