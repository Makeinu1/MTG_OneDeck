# O4P-01K-C Priority, Pass, and Resolution-Boundary Analysis

Status: `analyzed-not-integrated` (domain analyst draft)

Milestone: `O4P-01K`

Lane: C — priority cycle, consecutive passes, and resolution boundary

Input base: user-provided `PLAN_SHA=04e3268c0ca8e884153728590e0c2248a8edb458`,
`fork_context:false`, independent worktree

Ruleset: pinned local CR `2026-06-19` only

## Scope and grounding

This is a contract analysis only. It does not modify production code, tests,
docs, the ledger, package metadata, machine checks, or `review.*`. The relevant
shipped predecessor is `CoreStackTransactionBundleV1` from
`research/cr-grounding/o4p-01j-atomic-stack-transaction.contract.draft.md`.
O4P-01J provides atomic structural stack append, retarget, and removal; it
explicitly does not provide priority, pass, legality, resolution, SBA, or
trigger execution. O4P-01K may orchestrate those boundaries around it without
widening the O4P-01J bundle.

The deterministic rules are:

| CR | Grounded consequence |
|---|---|
| 117.1–117.2 | Priority permits player actions; triggers, turn-based actions, SBAs, and resolution are not ordinary priority actions. |
| 117.2a, 117.2c–e | Trigger handling, turn-based actions, SBAs, and resolution occur without priority at their specified boundaries. |
| 117.3a | The active player receives priority at most step/phase openings after turn-based actions and required trigger placement; untap and normally cleanup are exceptions. |
| 117.3b–c | After a non-mana spell/ability resolves, active player receives priority; after an action, the acting player receives priority again. |
| 117.3d | A pass transfers priority to the next player in turn order. |
| 117.4 | All players passing in succession resolves the top stack object, or ends the phase/step when the stack is empty. |
| 117.5 | Before a player actually receives priority, apply SBAs repeatedly, then put waiting triggers on the stack, and repeat until stable. |
| 500.2–.3 | Priority-bearing phases/steps end only after an empty stack and consecutive passes; no-priority steps end after their specified actions. |
| 502.4, 503.1, 504.2 | Untap has no priority; upkeep and draw grant initial priority to the active player after their prescribed boundary. |
| 514.3–.3a | Cleanup normally has no priority, but exceptional SBAs/waiting triggers create a priority window and another cleanup after it closes. |
| 405.1–.2, O4P-01J | Card spells and abilities share one ordered stack; stack-object identity is an ObjectId, not a mutable array position. |

## Canonical priority state

The lifecycle state must distinguish these facts rather than infer them from
stack length:

1. The current turn/phase/step and active player come from the existing
   mode-neutral registry/turn-order source; active player is not duplicated in
   the O4P-01J transaction bundle.
2. A priority window has either a current holder or an explicit
   `priority-unavailable` boundary. A no-priority boundary is not represented
   as an ordinary player holding priority.
3. The consecutive-pass set/order is tied to the current priority window and
   is cleared by every successful action, by a new priority grant after
   resolution, and by a phase/step transition.
4. A pass is valid only from the current holder and only once for that holder
   in the current consecutive-pass run. The next holder is the next eligible
   player in turn order; player exit is not eligible logic in this milestone.
5. A resolution-ready state records the exact current top ObjectId and the
   all-pass boundary that produced it. It must not rely on “last array entry”
   alone after any intervening transaction.

The exact TypeScript names and public shape are intentionally deferred to the
judge-owned O4P-01K contract.

## Priority-cycle matrix

| Case | Precondition | Required structural result | CR / boundary |
|---|---|---|---|
| Initial priority | A priority-bearing step/phase has completed its turn-based actions, stable SBA/trigger boundary, and active player is seated | Holder is active player; pass run is empty | 117.3a, 117.5; 503.1, 504.2, 505.6, 507.2 |
| Ordinary pass | Holder P passes; stack may be empty or nonempty | Record P in current run; holder becomes next player in turn order | 117.3d |
| Full pass, nonempty stack | Every player passes once in succession; stack top is T | Produce `resolution-ready` for exactly T; do not resolve while merely recording the final pass | 117.4; O4P-01K explicit-confirmation boundary |
| Full pass, empty stack | Every player passes once in succession; stack is empty | End the current priority-bearing phase/step and advance its lifecycle; do not create resolution-ready | 117.4, 500.2, 505.2 |
| Action reset | Current holder successfully casts/activates/takes an allowed special action | The action is appended/represented structurally, pass run is cleared, and acting player receives priority again | 117.3c; O4P-01J append boundary |
| Action while stack already nonempty | P acts while an earlier object is on stack | New object is appended above existing top; P receives priority; earlier passes no longer count | 117.3c, 117.7; CR 405.1–.2 |
| Next holder wrap | Last player in turn order passes | Holder wraps to first eligible player; no implicit active-player change | 117.3d |
| Stable boundary before grant | A grant would occur after an action, resolution, transition, or step opening | Apply the O4P-01K stabilization boundary first; only then grant the specified holder | 117.5; no priority during stabilization |

“All players” means all players in the current game for this lane. The
consecutive condition is broken by any successful action; a previous pass run
cannot be reused after an action or after a resolution/phase transition.

## Resolution boundary and stack identity

All-pass with a nonempty stack does not itself execute the object. It creates a
resolution-ready checkpoint containing the top ObjectId observed at the
boundary. An explicit controller/host confirmation may then authorize the
structural resolution step. Confirmation is valid only if:

- the priority window is still the same all-pass window;
- no action, retarget, append, or removal occurred after the checkpoint;
- the referenced ObjectId is still present and is still the stack top; and
- the complete O4P-01J bundle validates before and after the operation.

On confirmed structural resolution, the top object is removed through the
O4P-01J removal primitive using that ObjectId. A card spell’s destination,
spell-copy/ability cessation, target recheck, effect instructions, and any
replacement/counter decision are not inferred by this lane. The resulting
boundary is “post-resolution stabilization”: no player has priority while
resolution and its automatic consequences are being processed; after the
stable boundary, CR 117.3b gives the active player priority. If the confirmed
operation did not remove the same top identity, it fails atomically and does
not silently remove a newly exposed middle/top object.

Top removal and middle removal are distinct acceptance pins:

- Top removal: `[bottom, middle, top]` with confirmed `topId` yields
  `[bottom, middle]`; only `topId` is removed and the post-resolution boundary
  is entered.
- Middle removal: O4P-01J structural removal of `middleId` preserves the
  relative order of bottom and top, does not itself resolve either neighbor,
  and does not claim a resolution event. It is permitted only as an explicit
  structural operation from the surrounding lifecycle contract, not as a
  consequence of all-pass.
- Stale confirmation: after retarget or any append/removal, a confirmation for
  the old top checkpoint is rejected; no positional fallback is allowed.

## Entry and exit boundary matrix

| Boundary | Priority result | Required acceptance case |
|---|---|---|
| Untap | Unavailable for the entire step | Untap actions complete; triggers are held until the next priority opportunity; no cast/activation/resolution occurs in untap (502.1–.4). |
| Upkeep | Active player first after beginning-of-upkeep/held triggers are placed | Initial holder is active player, not the player who held a prior window (503.1–.1a). |
| Draw | Active player first after the draw action | Draw itself is not a response window; priority follows the turn-based action (504.1–.2). |
| Normal cleanup | Unavailable; after hand-size and expiry actions, step ends if no SBA or waiting trigger exists | No ordinary pass cycle is manufactured (514.1–.3). |
| Exceptional cleanup | SBA and/or waiting trigger exists | Perform SBA/trigger boundary, then active player receives priority; once the stack empties and all pass, begin another cleanup step (514.3a). |
| Resolution | Unavailable during resolution and stabilization | No player action or pass is accepted until the post-resolution stable grant (117.2e, 117.5). |
| Empty-stack all-pass | No resolution object | End the applicable priority-bearing phase/step and perform its transition; do not call O4P-01J removal. |

## Invalid and unavailable sequences

The contract should fail closed for these structural cases without inventing
new CR behavior:

- pass by a player who is not the current holder;
- a second pass by the same player before an action or new window;
- pass when priority is unavailable (untap, resolution/stabilization, normal
  cleanup, or an automatic transition);
- all-pass completion with a stale or incomplete player set;
- an action attempted by a player who does not hold priority;
- action reset that leaves the old pass run intact;
- resolution confirmation when the stack is empty, the recorded ObjectId is
  absent, or it is no longer the top object;
- resolving a middle object merely because it was named by an input;
- using stack array position as identity after O4P-01J zone-changing removal;
- granting priority before SBAs and waiting triggers reach the 117.5 fixed
  point; and
- treating a trigger as immediately on the stack at trigger time rather than
  placing it at the next priority boundary.

Player exit/concession is intentionally not modeled. A player leaving can
change object existence, controller effects, priority succession, and turn
continuation under CR 800.4; all such eligibility, reindexing, and priority
transfer are exact O4P-01M deferrals, not invalid-pass behavior in O4P-01K.

## Structural acceptance cases

The judge-owned contract should pin at least these cases:

1. Four players, active P1, empty stack: initial P1 priority; P1/P2/P3/P4
   pass; phase/step ends, with no resolution-ready object.
2. Four players, active P1, stack `[S1, S2]`: P1/P2/P3/P4 pass; only S2 is
   resolution-ready; explicit confirmation removes S2, preserves S1, then
   grants active P1 after stabilization.
3. Same stack: P1 passes, P2 acts and appends S3; pass state is empty and P2
   is holder; prior P1 pass cannot complete an all-pass event.
4. Same stack: a stale confirmation for S2 after S3 is appended is rejected;
   S3 remains top and no object is removed.
5. Middle structural removal of S1 or S2 preserves every remaining relative
   stack order and does not produce resolution-ready for a neighbor.
6. Untap rejects cast, activation, pass, and resolution; upkeep then starts
   with active-player priority after held/beginning triggers are placed.
7. Normal cleanup has no priority; exceptional cleanup opens active-player
   priority only after its SBA/trigger condition and requires another cleanup
   after its stack closes.
8. A pass by the wrong player, duplicate pass, pass during unavailable state,
   and action without priority each fail without mutating lifecycle or the
   O4P-01J bundle.
9. A synthetic spell-copy, activated ability, and triggered ability each use
   its exact O4P-01J ObjectId as top identity; no card-only assumption is made.
10. After confirmed removal, the next priority grant is active-player-first;
    after an ordinary action, the acting player—not automatically the active
    player—receives priority.

## Exact O4P-01K deferrals

O4P-01K may define and test the lifecycle orchestration, pass accounting,
priority-unavailable boundaries, stabilization checkpoints, explicit
resolution-ready confirmation, and calls to O4P-01J structural operations.
It must explicitly defer:

- concrete SBA condition evaluation and the full SBA catalog;
- trigger detection, trigger-controller derivation beyond supplied structural
  inputs, and any unsupported trigger family;
- full effect resolution, target legality/recheck, replacement effects,
  countering, copyable-values derivation, and permanent-spell conversion;
- Combat/attack/block/damage lifecycle;
- control and permission effects and any current-controller derivation not
  already supplied by the mode-neutral registry;
- Command/Event envelopes, actor/decision authority, replay, online protocol,
  projection, Cloudflare, and UI;
- player exit, concession, remaining-player eligibility, priority transfer on
  exit, and active-turn-without-active-player behavior — exact O4P-01M; and
- any final TypeScript export/name decision until the judge freezes the
  contract.

The honest O4P-01K result is therefore a deterministic lifecycle substrate
with a resolution-ready checkpoint and explicit confirmation hook, not a
claim that card effects have been automatically resolved.

Changed file: `research/cr-grounding/o4p-01k-c-priority-pass-resolution.draft.md`

Evidence read: pinned local CR 117, 500, 502–505, 514, 704; shipped O4P-01J
atomic transaction contract and stack-removal/fixture lane analyses; O4P-01K
orchestration plan and backbone ledger entry. No production code or review
test was changed; no git command was run.
