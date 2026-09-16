# Zones, events, and last-known information

<!-- clause: ENG-ZONES-001 -->
Zones follow the Comprehensive Rules distinction between shared zones and player-private zones. Battlefield, stack, exile, and command are shared views; library, hand, and graveyard are private views keyed by owner where the state carries that structure.

<!-- clause: ENG-ZONES-002 -->
Moving an object creates the zone-change boundary required by its new object identity. Owner and controller are preserved according to the existing card instance contract. Token cleanup and linked-exile records use the same transition pipeline as ordinary cards.

<!-- clause: ENG-ZONES-003 -->
Events are immutable records of successful semantic changes. Their source, subject, cause, ordering, and deterministic reference are retained when the existing event type provides them. A UI cue may consume an event, but presentation never delays the state transition.

<!-- clause: ENG-ZONES-004 -->
When an effect needs information about an object that has left its zone, the applicable last-known information is taken from the recorded transition data. The contract does not infer a value from a later object with the same printed card name.

<!-- clause: ENG-ZONES-005 -->
A lifecycle/administrative isolation state used for an eliminated or explicitly removed player's objects is not a Magic zone and must not be semantically reported as exile, command, graveyard, or another Comprehensive Rules zone. Its purpose is to remove those objects from ordinary game participation while preserving enough attributable state for correction, audit, or supported undo/recovery semantics.
