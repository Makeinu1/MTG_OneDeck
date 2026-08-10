# O4P-01K-D: SBA / Pending Trigger / Cleanup Grounding Analysis

- Milestone: `O4P-01K`
- Lane: Domain Analyst, independent (`fork_context:false`)
- Base: `PLAN_SHA=04e3268c0ca8e884153728590e0c2248a8edb458`
- Rules authority: pinned local Comprehensive Rules, effective 2026-06-19
- Status: `analyzed-not-integrated`
- Scope: analysis only; no production code, tests, exports, ledger, docs, or git

## Executive ruling

O4P-01K should model one reusable lifecycle gate:

1. when priority would be granted, perform one SBA check event;
2. if that event performed any SBAs, repeat the check before looking at the
   pending-trigger queue;
3. if no SBA was performed, place all pending triggered abilities using the
   two-part APNAP procedure, then repeat the SBA/trigger gate because placing
   triggers can make new SBAs or triggers relevant; and
4. grant priority only after the fixed point has no performed SBA and no
   pending trigger.

This is the procedural boundary in CR 117.5 and 704.3. It is not a complete
CR 704 evaluator and it is not a trigger detector. A future implementation
may accept already classified, immutable SBA and trigger facts, but it must
not infer them from card text or silently treat an unclassified event as
handled.

The cleanup step is a deliberately different terminal gate. CR 514.1 and
514.2 perform discard and the simultaneous damage/effect-expiry actions. CR
514.3a then checks SBAs and waiting triggers. If neither exists after the
first check, no player receives priority and cleanup ends. If either exists,
SBAs are performed, triggers are placed, priority is granted, and after the
stack empties and players pass, another cleanup step begins. “Grant priority
if stable” is therefore true for ordinary priority boundaries, but cleanup
must use “grant priority only when the exceptional condition exists”; stable
cleanup terminates without priority.

## CR grounding

### Procedure and fixed point

- **CR 704.1**: SBAs are automatic game actions and do not use the stack.
  They are not choices, triggered abilities, or player-controlled commands.
- **CR 704.1a**: an ability watching for a game state is a triggered ability,
  not an SBA. A state trigger must not be merged into an SBA bucket.
- **CR 704.2**: SBAs are checked throughout the game and are not controlled
  by any player.
- **CR 704.3**: at each priority boundary, applicable SBAs are performed
  simultaneously as one event; if any were performed, the check repeats.
  Only a check with no performed SBA proceeds to waiting-trigger placement.
  After placement, the process checks again until neither SBAs nor waiting
  triggers remain. Cleanup uses the same mechanism with the explicit
  no-priority exception.
- **CR 117.5**: the same sequence is run each time a player would get
  priority. The appropriate player receives priority only after the complete
  SBA and trigger fixed point.
- **CR 117.4**: successive passes resolve the top stack object, or end the
  phase/step when the stack is empty. A pass counter is consequently reset by
  any non-pass action and by a resolution; it is not a property of a trigger.

### Pending triggers and placement

- **CR 603.2**: a trigger condition being met creates a triggered ability;
  it is not yet the committed stack object in O4P-01I/J terms.
- **CR 603.3**: the controller puts the triggered ability on the stack as a
  non-card object the next time priority would be received. It becomes the
  topmost object and retains the creating ability's text and no other
  characteristics.
- **CR 603.3a**: controller is the source controller at trigger time, except
  for delayed-trigger rules. Placement must use this historical controller,
  not a later source lookup or current controller recomputation.
- **CR 603.3b**: placement has two buckets. First, in APNAP order, each
  player orders the ordinary triggered abilities they control (a trigger
  condition that is not another ability triggering on the stack). Second, in
  APNAP order, each player orders the remaining abilities, including abilities
  triggered by another ability triggering on the stack. Each player chooses
  the order within their own bucket. After placement, SBA/trigger checking
  starts again.
- **CR 603.3c-d**: modal and announcement-time choices occur at placement;
  if no legal required choice can be made, the ability is removed rather than
  committed. This lane does not evaluate those choices, but the placement
  boundary must have an explicit failure/no-partial-state result.
- **CR 101.4, 101.4b-c**: APNAP is active player then nonactive players in
  turn order; later players know earlier choices, and a player chooses the
  order of simultaneous choices when no order is specified. The resulting
  stack order is the reverse of each player's placement sequence because
  each new object is placed on top (CR 405.2).
- **CR 101.4d**: if a nonactive player's choice creates a choice for the
  active player or an earlier nonactive player, APNAP restarts for outstanding
  choices. A fixed “one pass through buckets” algorithm cannot claim full
  coverage of this restart rule.

### Cleanup

- **CR 514.1**: the active player discards down to maximum hand size as a
  turn-based action; it does not use the stack.
- **CR 514.2**: damage marked on permanents is removed and all “until end of
  turn” and “this turn” effects end simultaneously; this also does not use
  the stack.
- **CR 514.3a**: cleanup then checks for SBAs and waiting triggers, including
  triggers for the beginning of the next cleanup step. If present, SBAs are
  performed, triggers are placed, and the active player gets priority. After
  the stack empties and all players pass, another cleanup step begins.
- **CR 703.4n-p**: the turn-based discard and simultaneous cleanup actions
  occur immediately at cleanup start and after discard, respectively. They
  are not ordinary priority actions and must not be announced as stack
  objects.

## Proposed structural boundary (not public TypeScript naming)

The lifecycle state needs four conceptually separate, immutable regions. The
names below are descriptive only and do not choose final API names.

### 1. SBA result / check event

A check result must distinguish:

- no applicable SBA;
- one or more applicable SBAs performed as one batch;
- deterministic, complete issue/failure information if the supplied facts are
  invalid; and
- the next boundary: repeat SBA check, inspect triggers, or grant priority.

The batch is semantic: independent simultaneous SBAs are not serialized as a
sequence whose intermediate state is observable. A successful batch produces
one candidate state; that candidate is checked again. Within this lane, the
individual SBA catalog is a supplied fact boundary, not an evaluated rule.

### 2. Committed pending-trigger record

A pending record represents one trigger occurrence after detection and before
stack placement. It must retain, at minimum:

- a unique deterministic pending occurrence ID;
- its controller fixed at trigger time, including the already-resolved
  delayed-trigger controller rule;
- a historical source reference or explicit source-absent form;
- the immutable ability identity/text snapshot needed by the later O4P-01J
  synthetic commit;
- its ordinary-versus-ability-triggered placement bucket;
- the trigger observation/announcement facts already fixed at that boundary;
- a deterministic occurrence position for same-controller choice ordering; and
- no live-source requirement, current-controller lookup, or effect-resolution
  payload.

The pending ID is not a Core ObjectId and must not collide with a committed
stack object identity. It should be derived from caller-supplied deterministic
event/turn context and an occurrence ordinal, never from time, randomness, a
map traversal, or a source name. The ID is historical bookkeeping: once
placed, the O4P-01J synthetic object ID is the committed identity and the
pending record is consumed atomically.

No pending record may be silently deduplicated. If one ability triggers twice,
two occurrences are required unless an applicable CR rule explicitly says the
ability triggers additional times or only once. The trigger detector must own
that classification; this lane does not implement it.

### 3. Placement decision / order

Placement consumes a snapshot of pending records and produces one ordered
batch. It must:

- group by the two CR 603.3b buckets first;
- traverse players in active-player-first turn order for each bucket;
- preserve each player's explicit chosen order, including a deterministic
  fallback only where the surrounding contract explicitly says choices are
  already fixed;
- never globally sort by source ID, pending ID, controller ID, or text;
- append each selected triggered ability to the top of the one shared stack;
- use O4P-01J atomic synthetic-stack commit for each item while exposing only
  the all-or-none result; and
- consume exactly the placed pending records, leaving other records unchanged.

The order must be deterministic for identical input and explicit choices. A
same-controller order is not “stable map order” and is not an ObjectId sort;
it is the controller's chosen order, with a contract-defined deterministic
order only for a fixture that has already supplied that choice.

### 4. Turn/cleanup gate

The lifecycle coordinator must carry a phase/step context sufficient to tell
an ordinary priority boundary from cleanup. It must not duplicate the active
player or turn order: O4P-01K's source remains the shipped
`ModeNeutralCoreObjectRegistrySliceV2` as stated by the orchestration plan.

The coordinator may carry pass state and cleanup repetition state, but these
are procedural lifecycle state, not fields added to the O4P-01J transaction
bundle. A successful transition must preserve all unrelated registry,
runtime, announcement, stack, and pending records.

## Explicit invariants

### SBA and priority invariants

1. No SBA uses the stack, creates a pending trigger merely by being an SBA,
   or grants priority in the middle of an SBA batch (CR 704.1-704.3).
2. If an SBA batch changed state, pending triggers are not placed until the
   next SBA check reports no SBA performed.
3. If trigger placement or its required announcement choices produce a new
   SBA or pending trigger, the fixed-point loop repeats before priority.
4. Ordinary priority is granted iff the post-loop state has no performed SBA
   and no pending trigger.
5. A no-SBA check is not the same as a no-trigger check; both conditions are
   required for priority.
6. A batch failure is atomic: no SBA, pending-trigger consumption, stack
   placement, pass-state mutation, or cleanup flag is externally visible.

### Pending-trigger invariants

7. Each pending occurrence has exactly one controller-at-trigger and exactly
   one historical source reference representation; current source absence is
   not a reason to discard it (CR 603.3a; O4P-01J historical-reference rule).
8. Pending records are not stack announcements and do not appear in the O4P-01I
   `byObject` map until O4P-01J commits the synthetic triggered-ability object.
9. Pending records are neither globally sorted nor deduplicated. Their
   identity and occurrence order are stable under JSON round trip.
10. Placement is exactly-once: success removes each placed pending ID once;
    failure removes none and adds no partial synthetic object.
11. Ordinary and ability-triggered buckets are disjoint and exhaustive for
    the supported input classification. No detector semantics are inferred by
    the placement code.

### APNAP and stack invariants

12. For each bucket, player traversal is active player followed by the
    remaining players in turn order (CR 101.4, 603.3b).
13. A player's selected order is preserved. Committed stack order is the
    top-appending order induced by those choices, not a re-sort of records.
14. A source changing zones after trigger detection does not change the
    pending controller, source history, or ability text. O4P-01J's commit
    may use the historical reference and must not rebind by name.
15. If an outstanding choice invokes CR 101.4d restart semantics, the
    lifecycle must represent/reject that unsupported case explicitly; it must
    not claim ordinary APNAP completion.

### Cleanup invariants

16. Cleanup discard occurs before damage clearing and effect expiry; damage
    clearing and “until end of turn”/“this turn” expiry are one simultaneous
    action boundary (CR 514.1-514.2).
17. Stable cleanup (no SBA and no waiting trigger after the initial cleanup
    check) ends without priority.
18. Cleanup with an SBA or waiting trigger performs the same fixed-point
    ordering, then grants priority. After the stack empties and all players
    pass, it starts another cleanup step rather than resuming ordinary phase
    priority.
19. A cleanup-triggered ability waiting for the next cleanup step is included
    in the cleanup check; a trigger placed during exceptional cleanup can
    cause another cleanup after resolution.
20. Damage marks are cleared exactly at the cleanup action boundary, while
    effects that expire at end of turn expire there; neither action is modeled
    as an SBA or stack object.

## Acceptance tests for the future contract

These are analysis-level acceptance pins, not review tests and not an
authorization to implement them in this lane.

1. **SBA repeat**: one supplied SBA batch changes state; assert no priority
   and no pending placement before the second check; a no-SBA second check
   permits trigger inspection.
2. **SBA batch atomicity**: two applicable SBAs are reported/performed as one
   event; assert no observable intermediate state and deterministic result.
3. **No-SBA/no-trigger**: ordinary priority is granted only after both queues
   are empty; a no-SBA result alone is insufficient.
4. **Pending survives source loss**: detect a trigger, move/remove its source,
   then place it; controller-at-trigger and historical source remain and the
   O4P-01J triggered object is committed.
5. **Duplicate occurrences**: the same ability triggers twice in one event;
   assert two distinct pending IDs and two placements unless the supplied CR
   classification explicitly limits triggering.
6. **Two APNAP buckets**: active player and two nonactive players each have
   one ordinary and one ability-triggered record; assert ordinary bucket is
   placed for all players before the second bucket, with APNAP order within
   each bucket.
7. **Same-controller choice**: a controller supplies a non-source-ID order;
   assert that order is preserved and not replaced by lexical sorting.
8. **Determinism**: identical canonical input and choices produce byte-equal
   JSON output; reordered input object properties do not change canonical
   output, while reordered choice arrays do change the prescribed order.
9. **Placement atomicity**: an invalid later trigger announcement fails the
   complete placement; assert no earlier synthetic commit and no pending
   consumption remains.
10. **Post-placement repeat**: placement creates a newly applicable SBA and a
    new pending trigger; assert both are processed before priority.
11. **Cleanup stable**: discard is unnecessary, damage/effects are cleared,
    no SBA and no waiting trigger exist; assert cleanup ends with no priority.
12. **Cleanup exceptional**: cleanup produces an SBA or waiting trigger;
    assert SBA fixed point, APNAP placement, then active-player priority.
13. **Cleanup repetition**: after exceptional cleanup stack resolution and
    successive passes, assert a new cleanup step starts and stable cleanup
    ends without priority.
14. **Cleanup simultaneous boundary**: assert marked damage is cleared and
    “until end of turn”/“this turn” effects expire together after discard, not
    before it and not through a stack object.
15. **Pass reset**: a non-pass action or stack resolution resets consecutive
    passes; only all players passing in succession advances resolution/step
    per CR 117.4.
16. **Unsupported restart**: a CR 101.4d choice dependency is either modeled
    with explicit restart semantics or rejected as deferred; it cannot be
    silently linearized.

## Detection boundary and DEFERs

The detector boundary is: given a committed event/result and the applicable
continuous/trigger context, produce zero or more validated pending trigger
occurrences, with their controller, source history, bucket, and deterministic
occurrence identity. It must not place objects on the stack. It must not
re-read an absent source, infer triggers from an SBA, or claim that a trigger
exists merely because a state resembles a card's text.

Explicitly deferred from O4P-01K-D:

- the complete CR 704.5/704.6 catalog, replacement effects, choices, LKI,
  simultaneous-result details, Commander-specific SBA catalog, and effect
  resolution;
- Oracle parsing, trigger detection, intervening-if evaluation, state
  triggers, zone-change look-back, delayed/reflexive trigger creation, and
  “triggers additional times”/“only once each turn” semantics;
- modal-choice legality and the full CR 601.2c-d placement procedure;
- CR 101.4d restart implementation beyond an explicit unsupported result;
- priority action legality, spell/ability resolution, combat, turn-based
  actions outside cleanup, and active-player rotation details;
- target legality, effect expiry generation, replacement/prevention, and
  final GameState/replay semantics;
- public TypeScript names, production files, review tests, machine-check
  registration, package changes, ledger/docs changes, CI, Pages, and release.

## Evidence and handoff

Evidence read: pinned CR sections 101.4, 117.4-117.5, 514.1-514.3a,
603.2-603.3d, 603.8, 603.10, 603.12, 704.1-704.4, and 704.5; O4P-01I
Stack Announcement Payload & Lifecycle V1; O4P-01I announcement primitives;
O4P-01J Atomic Stack Commit, Retarget & Removal Transaction V1; O4P-01J
synthetic stack commit; and `o4p-01k-orchestration-plan.draft.md`.

No production code or review test was changed. No test result, audit result,
integration status, or release status is claimed.

Changed file: `research/cr-grounding/o4p-01k-d-sba-trigger-cleanup.draft.md`

Final status: `analyzed-not-integrated`
