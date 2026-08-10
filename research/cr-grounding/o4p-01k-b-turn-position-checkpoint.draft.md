# O4P-01K-B: Turn Position and Checkpoint Grounding Draft

Status: Domain Analyst draft; not a promoted contract, implementation brief,
review test, ledger update, or release evidence.

Milestone: O4P-01K
Base: `04e3268c0ca8e884153728590e0c2248a8edb458`
Role: Domain Analyst; `fork_context: false`
Scope: turn position, phase/step checkpoints, object-incarnation references,
and boundaries needed by the lifecycle slice. No attack/block state is designed.

## CR grounding

The pinned ruleset is `rule/Magic_The_Gathering_Comprehensive_Rules.txt`,
effective 2026-06-19.

### Position grammar

- CR 500.1 defines the five ordered phases: beginning, precombat main,
  combat, postcombat main, and ending. Beginning, combat, and ending are
  subdivided into steps. A position therefore needs both phase and step
  dimensions; it cannot be represented as a flat phase label.
- The phase/step discriminant must make `main` a phase with no step. CR 505.2
  says a main phase has no steps and ends by the empty-stack/consecutive-pass
  rule. A non-main phase has only its legal step family. This rejects values
  such as a non-null step attached to either main phase.
- Beginning is exactly untap -> upkeep -> draw (CR 501.1). Combat is beginning
  of combat -> declare attackers -> declare blockers -> combat damage -> end of
  combat (CR 506.1). Ending is end -> cleanup (CR 512.1). The standard
  relation is ordered successor within a phase, then the next standard phase;
  after cleanup, the next turn starts at that turn's beginning phase.
- The standard relation must be a relation over position *instances*, not only
  labels. A repeated combat phase, repeated combat-damage step (first/double
  strike), extra phase, or extra step is a distinct occurrence even when its
  phase/step labels equal an earlier occurrence. CR 500.8-.10 insert these
  instances relative to an anchor and use most-recent-first ordering where
  specified.
- CR 500.11 defines skipping as proceeding past the skipped position as if it
  did not exist. CR 500.12 forbids game events between adjacent positions. The
  transition path must therefore expose skipped boundaries without inventing a
  player-priority window or an event between them. In particular, a combat
  phase with no attackers skips declare blockers and combat damage (CR 506.1,
  508.8); it still has beginning-of-combat, declare-attackers, and end-of-
  combat boundaries unless another effect skips them.

### Checkpoints and turn-based actions

- Untap is a no-priority step (CR 502.3-.4). Phasing and simultaneous untap
  occur there; triggers wait until the next priority opportunity, normally
  upkeep. The lifecycle checkpoint must not grant priority between untap's
  turn-based actions or treat an untap trigger as already placed.
- Upkeep has no turn-based action; beginning-upkeep and held untap triggers are
  placed before the active player receives priority (CR 503.1-.1a). This is the
  first ordinary beginning-of-step priority checkpoint.
- Draw first performs the active player's draw, then grants priority
  (CR 504.1-.2). The checkpoint must distinguish the draw action from the
  subsequent priority point.
- Beginning of combat has its defending-player turn-based choice where
  applicable, then priority (CR 507.1-.2). This lane records only the position
  boundary; it does not design combat participants or attack/block state.
- Every priority-bearing step/phase uses the CR 500.2 / 117.4 rule: an empty
  stack alone does not advance; all players must pass in succession. CR 117.5
  gives the preceding fixed-point checkpoint: perform all applicable SBAs as a
  single event, repeat until stable, place waiting triggers, repeat until no
  SBA or trigger remains, and only then grant priority.
- At each phase/step beginning, “at the beginning of” triggers occur (CR
  500.6). At the end of a phase/step, that boundary expires end-of-phase/step
  effects and empties all unspent mana (CR 500.5). Thus mana emptying is a
  boundary action, not a cleanup-only action. Cleanup additionally removes
  marked damage and ends “until end of turn”/“this turn” effects (CR 514.2).
- Per-turn state is reset at the appropriate turn boundary, not when a label is
  revisited. At minimum, the checkpoint contract must provide a deterministic
  turn-start reset boundary for land-play/turn-usage records and similar
  per-turn flags, while leaving the concrete card/effect catalog to later
  slices. The first main phase is precombat; every other main phase in that
  turn, including after a skipped combat or an extra combat, is postcombat
  main (CR 505.1a). “First/second main” counts occurrences in the current turn
  (CR 505.1b), so occurrence identity is required.

### Active rotation and extra positions

- The active player is fixed for a turn and rotates in turn-order sequence
  when the current turn ends. O4P-01K must derive rotation from the shipped
  registry's authoritative player order and active-player field; it must not
  copy a second turn-order or active-player value into the lifecycle slice.
- Extra turns are inserted directly after the specified turn; multiple turns
  are inserted one at a time, and the most recently created turn occurs first
  (CR 500.7). Extra phases and steps are similarly inserted after/before their
  anchor, with most-recent-first ordering where CR 500.8-.9 applies. A turn
  identity and a position-instance identity must survive these insertions.
- A phase or step that is skipped has no checkpoint actions belonging to that
  position. Do not run its untap/draw/reset/trigger/expiry action merely because
  the successor relation passed its label. Extra beginning phases with only an
  upkeep step are a direct CR 500.10 example: their untap and draw steps are
  skipped.

### Object identity and duration anchors

- CR 400.7 says a zone move creates a new object with no memory or relation to
  the previous object, subject to listed exceptions. Existing O4P-01G/H object
  identity and runtime contracts therefore require lifecycle references to use
  the current canonical object identity, not a physical-card identity or a
  display/card index. A delayed boundary or participant reference must stop
  matching after a zone transition unless a specific CR exception applies.
- A position identity is different from object identity: the former identifies
  one occurrence of a phase/step/turn; the latter identifies one game object
  incarnation. Both are needed for “during this turn,” “until end of combat,”
  “beginning of the next end step,” and repeated combat boundaries.
- O4P-01K may expose expiry *checkpoints* and stable duration anchors: start of
  a position, end of a position, cleanup's CR 514.2 expiry, and next-turn/next-
  end-step occurrence matching. It must not derive or apply arbitrary
  continuous effects. The anchor must include occurrence identity so an effect
  created during the current end step does not incorrectly fire at that same
  step's beginning (CR 513.2).

## Required invariants for the future contract

1. Every accepted position is one valid discriminated phase/step case; main
   phases always carry no step, and no step is accepted under the wrong phase.
2. The position sequence is deterministic and preserves turn, phase occurrence,
   step occurrence, and standard-vs-inserted/skipped provenance. Equal labels do
   not imply equal instances.
3. The successor relation has no hidden event between positions (CR 500.12),
   and skipped positions cannot run their turn-based actions, priority, trigger,
   mana, or expiry checkpoints.
4. Active player and turn order are read from the registry authority. Lifecycle
   state does not duplicate or silently diverge from those values.
5. A boundary action is idempotent per position instance: untap/draw/turn reset,
   mana emptying, and expiry cannot run twice merely because a transition is
   retried or a label repeats. Cleanup may repeat only through the explicit CR
   514.3a exception.
6. Cleanup has a no-priority fast path, but if SBAs or waiting triggers exist it
   creates a priority-bearing cleanup repetition (CR 514.3-.3a), and only after
   the resulting stack is empty and all players pass does another cleanup begin.
7. Any object reference stored for a boundary is checked against the current
   canonical object incarnation; a re-entered card is not the old object.
8. Successful canonical values remain input-preserving, deterministic,
   JSON-round-trippable, and deeply frozen, matching the shipped Core object,
   runtime, and stack validation conventions.

## Acceptance implications

Acceptance should be contract-level, not combat-state coverage:

- canonical standard sequence: untap/no priority -> upkeep checkpoint -> draw
  checkpoint -> precombat main (`step = null`) -> beginning of combat ->
  declare attackers -> declare blockers/combat damage skipped when no attackers
  -> end of combat -> postcombat main -> end -> cleanup -> next turn;
- reject invalid phase/step combinations and accept both main phases as the
  same phase family with distinct turn-local occurrences;
- assert untap and cleanup normally do not grant priority, while upkeep/draw/
  main/each priority-bearing combat step do after the CR 117.5 fixed point;
- assert end-of-step mana emptying, cleanup damage/duration expiry, and no
  expiry at the wrong repeated occurrence;
- assert repeated combat damage steps and extra phase/step insertion are
  distinct positions, most-recent-first where applicable, and skipped positions
  do not execute their checkpoints;
- assert cleanup repetition when an SBA or waiting trigger exists, including no
  duplicate per-turn reset or expiry;
- assert active-player rotation follows registry turn order and that an extra
  turn changes the next turn instance without mutating the authoritative order;
- assert a delayed/boundary reference to object A does not match the new object
  after A leaves and re-enters a zone, while the position anchor remains the
  same only when the CR-defined position instance is the same;
- assert hostile/extra/accessor input rejection and frozen canonical output in
  the same style as the shipped Core runtime/stack validators.

No acceptance case should require attack declarations, blockers, combat
assignments, damage distribution, first-strike legality, commander damage, or
player defeat.

## Explicit deferrals

### O4P-01K owns

Turn/phase/step position grammar and deterministic successor relation; standard
and inserted/skipped position instances; active-player rotation by registry
order; priority/pass checkpoints and CR 117.5 fixed-point boundary; turn-based
checkpoints for untap/draw/main/cleanup; mana emptying at phase/step end;
cleanup repetition; placement boundary plumbing for already-known pending
triggers; and stable duration/expiry checkpoint identity. Concrete SBA
condition evaluation, trigger detection, effect resolution, and combat state
remain bounded/manual as stated by the orchestration plan.

### O4P-01L deferral

Control effects and current-controller derivation (CR 611/613), permission and
visibility, actor/selector separation, and opponent-turn decision authority.
O4P-01K must preserve the controller/active-player distinction and object
incarnation hooks, but must not implement control-changing effects or derive
their duration semantics.

### O4P-01M deferral

Commander physical-card identity/tax/damage, multiplayer attacks and blocks,
combat assignments, player defeat/concession, and the broader CR 104/506/507/
508/903 boundary. O4P-01K's repeated combat position is structural only; it
does not design attack/block state or claim automatic combat damage.

## Read-only evidence

- Fixed CR: `rule/Magic_The_Gathering_Comprehensive_Rules.txt` (CR 117,
  400.7, 500-514, 603, 704; verified locally at the cited rule headings).
- O4P-01K plan and boundary: `research/cr-grounding/o4p-01k-orchestration-plan.draft.md`.
- Ledger domain boundaries: `research/cr-grounding/cr-backbone-ledger.json`
  (O4P-01K/O4P-01L/O4P-01M entries).
- Shipped Core object authority: `src/engine/core/object/objectRegistryStateV2.ts`
  and `src/engine/core/object/objectRegistryValidationV2.ts`.
- Shipped runtime identity cross-state validation:
  `src/engine/core/object/objectRegistryValidationV2.ts` and
  `src/engine/core/runtime/cardRuntimeValidation.ts`.
- Shipped stack bundle composition and validation:
  `src/engine/core/stack/transaction/stackTransactionBundleV1.ts` and
  `src/engine/core/stack/transaction/stackTransactionValidationV1.ts`.
- Historical combat analysis was consulted only to avoid importing combat
  design into this lane: `research/cr-grounding/archive/combat/`.

Changed file: this draft only.
