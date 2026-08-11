# O4P-01M Player Exit, Concession, and Cross-Slice Lifecycle Grounding

Status: grounding-only / analyzed-not-integrated

Milestone: `O4P-01M`
Base SHA: `1d5a75a60bc6f13a4ed6fd3daf7687e2ed4a0dcf`
Role: grounding analyst — player exit and cross-slice lifecycle
Rules authority: repository-local pinned CR `2026-06-19` only

This report is read-only grounding. It does not freeze a contract, select an
implementation, or claim that an unshipped candidate exists. It does not add an
API name to the facts below. `FACT`, `GAP`, `PROPOSAL`, `DEFER`, and `STOP` are
kept separate deliberately.

## 1. Authority and stop findings

### Facts confirmed

- The live ledger has exactly one `O4P-01M` entry in `domains` and exactly one
  matching `plannedSequence` entry. Both are `pending`, depend on `O4P-01L`,
  and name CR `104`, `506`, `507`, `508`, and `903`.
- The ledger landing state is Commander physical-card identity, Commander tax
  and cast count, Commander replacement choice, Commander damage, multiplayer
  attacks/blocks, player exit, and concession. Its explicit manual boundary
  permits guided/manual combat damage and requires WebSocket disconnect to stay
  distinct from player exit.
- `O4P-01L` is marked `shipped` in both ledger collections. Its evidence records
  the final narrow cold audit as clean, the same-fingerprint full check as
  passed, Actions success, and Pages/served asset HTTP evidence. This is ledger
  evidence of the prerequisite shipment, not a new candidate for `O4P-01M`.
- `.claude/loop-state.md` identifies `O4P-01M`, `preflight`, the supplied base
  SHA, and says that no shipped or unpushed candidate is present in this
  checkout.
- The active contract manifest is still headed
  `VALIDATION-HARDENING-2026-08`. It lists generic active engine contracts for
  state, commands, zones, turn/priority/stack, and multiplayer, but it does not
  list an active `O4P-01M` contract.

### STOP findings

**STOP-M-01 — O4P-01M contract authority is not active.** The live ledger is a
pending entry and the active manifest has no O4P-01M contract entry. This draft
can establish grounding and bounded questions only. A judge-owned O4P-01M
contract must be explicitly frozen before implementation or acceptance work.

**STOP-M-02 — launch/release preflight is not evidenced by this lane.** This
lane intentionally did not run git commands, `npm ci`, `npm run check`, the
forbidden scan, or a fresh CI/Pages check. The supplied base SHA and the shipped
O4P-01L ledger evidence are recorded, but this report is not launch or release
authorization.

### Resolved document discrepancy

`research/cr-grounding/o4p-01l-f-cross-slice-bundle.draft.md` is marked
`status: drafted` and proposes an eight-key root using names such as
`turnPriority`, `continuity`, `decisionAuthority`, and `playPermission`. It is
not the shipped authority. The O4P-01L judge-owned contract explicitly rejects
that proposal, and the shipped source, review test, and verifier use the
six-field bundle:

```text
turnPriorityBundle
control
visibility
searchSessions
playPermissions
decisionAuthorities
```

This is resolved by status and the later judge-owned source/test authority; the
eight-field draft must not be used as an O4P-01M fact.

## 2. Pinned CR facts relevant to this slice

| Topic | Pinned rule fact | Lifecycle consequence |
|---|---|---|
| Concession | CR 104.3a: a player may concede at any time; concession makes that player leave immediately and lose. CR 405.6g says concession does not use the stack. CR 723.6 says a player controlling another player cannot make that player concede; the controlled player may concede. | Concession is an explicit player action. It is not a decision that a player-controller or Decision Authority may exercise for someone else. |
| Defeat | CR 104.3b-d and 104.3j, together with CR 704.3/704.5 and 704.6c, make life-zero, empty-library draw, poison threshold, and 21 combat damage from one Commander state-based-action conditions checked before priority. | A defeat condition is not the same fact as an explicit concession. If the game enforces the defeat, CR 104.5/800.4 supplies the player-leaves-game consequence; the current Solo product records defeat advisories instead of hard-enforcing them. |
| Multiplayer exit | CR 800.4a: when a player leaves, objects they own leave, control effects giving them control end, non-card stack objects they control cease to exist, and remaining objects they control are exiled. This happens immediately, not as a state-based action. | Exit is a cross-slice cleanup, not merely a status label or a turn-order deletion. Owner, controller, stack-object kind, and source references need separate treatment. |
| Priority on exit | CR 800.4a and 800.4j: if the leaving player had priority, priority passes to the next remaining player; a turn can continue without its active player, and the next remaining player or the stack/step boundary determines what happens. | A fixed all-seated-player rotation is insufficient after exit. The active-player and priority-holder cases must be specified together. |
| Turn order | CR 117.1-117.5, 500-514, and 101.4 define priority, pass order, turn/step boundaries, SBA checks, pending triggers, cleanup repetition, and APNAP ordering. | The next eligible player after exit must be a contract decision; it cannot be inferred by deleting an ID from one array while leaving K's contiguous-pass invariants unchanged. |
| Combat | CR 506.2/506.2a and 507.1 allow multiplayer attack/defend choices; CR 506.4 removes a permanent from combat when it leaves or changes controller; CR 510.2 makes combat damage simultaneous; CR 800.4e forbids damage assignment to a player who has left. | A player exit during or before combat must prune or resolve assignments under an explicit rule boundary. It is not equivalent to merely setting life to zero. |
| Owner/controller | CR 109.4, 110.2, 400.3, 400.6-400.7, and 405.4 keep owner, permanent controller, spell controller, and new-object identity distinct. | Exit cleanup must not rewrite ownership into controller, or treat a departed controller as a surviving owner. |
| Commander identity | CR 903.3 keeps Commander designation attached to the card across zones; CR 903.8 adds `{2}` per previous cast from the command zone; CR 903.9a-b define Commander replacement choices; CR 903.10a defines 21 combat damage from the same Commander to one player. | Physical-card identity, cast count, replacement choice, and damage recipient/source identity are separate pieces of state. |
| Player control | CR 723.3 says controlling a player changes only that player's choices; their object controllers remain normal. CR 723.5 covers rules/object choices and resources; CR 723.6 excludes concession. | Decision Authority and control effects cannot be used as a general exit, concession, or outside-the-game authority. |

## 3. Cross-slice fact matrix

The “current gap” column describes observed absence or mismatch. It is not a
proposal to change the named slice.

| Surface | Shipped/current fact | Current gap exposed by player exit |
|---|---|---|
| Object Registry / identity (O4P-01G/H) | Registry V2 carries `players`, ordered `turnOrder`, `activePlayerId`, physical cards, universal objects, and zones. Card objects preserve physical-card identity, incarnation, owner, and base controller. G/H validators require player-set/turn-order consistency and seated owner/controller references. G zone transition creates a fresh incarnation and resets old runtime. | There is no lifecycle status or departed-player policy. Removing a player from the registry would conflict with current owner/controller/reference validation; retaining the player requires a separate eligibility meaning. No such choice is shipped. |
| Turn / priority (O4P-01K) | Registry `activePlayerId` and `turnOrder` are the sole active-player/order source. Turn lifecycle windows name a player; priority windows carry cycle start, holder, and passed IDs. Validation requires those IDs to be seated and passed IDs to be a contiguous turn-order interval. | No operation normalizes a priority cycle, turn-based-action window, cleanup requirement, or active turn after a player leaves. O4P-01K explicitly leaves player exit/concession and remaining-player priority eligibility to O4P-01M. |
| Stack announcement (O4P-01I) | Announcements are committed structural choices for card spells, spell copies, activated abilities, and triggered abilities. Target player references are historical snapshots; validation does not require a target to remain present, active, or legal. | The slice does not decide whether an exited player target is illegal, ignored, replaced, or retained for later resolution. It also does not remove objects owned/controlled by a departing player. |
| Stack transaction (O4P-01J) | The transaction joins Registry, Runtime, and Announcement into one fresh validated bundle. Card spell commit preserves physical-card identity/owner, creates a new incarnation, and requires a seated supplied controller. Synthetic stack objects require a seated controller. Removal/retargeting is structural only. | CR 800.4 cleanup can require removing owned card objects, ceasing controlled non-card objects, exiling other controlled objects, and handling pending choices. No exit transaction or ordering is defined. |
| Control / continuity (O4P-01L) | Ordered control effects target battlefield cards/tokens, stack cards, and spell copies; the last applicable ordered effect wins. Continuity is explicit and not inferred from Solo fields. Sources can be pruned only by an explicit lifecycle/transition operation. | CR 800.4a/c requires effects giving a departed player control to end and can exile an object whose default controller departed. The O4P-01L control slice does not define that cleanup; combat removal and player exit are explicit deferrals. |
| Decision Authority (O4P-01L) | `controlledPlayerId` and `decisionMakerPlayerId` are separate. Scope can be active turn, decision, search session, or game. Authority changes choices, not object controllers, active player, turn order, or resource ownership. Concession and outside-game choices are excluded. | No fallback or invalidation rule exists when the controlled player or decision maker leaves. CR 800.4g/h distinguishes controller-made choices and rule-required choices, so one generic fallback would be unsafe. |
| Visibility (O4P-01L) | Visibility is an in-game identity-view decision. Public/private and face-down rules are explicit; grants have ordered audiences and durations. It does not create a player/table projection. | No exit-time audience revocation, retained snapshot policy, or handling of a departed searcher/selector is defined. A visibility grant must not silently become broader because a player leaves. |
| Search sessions (O4P-01L) | A session records rules actor, selector, zone, portion, candidate object IDs, criteria, reveal flag, and shuffle-after flag. Candidates are a snapshot; completion rejects a stale snapshot and invalid selection; cancellation removes the session without moving cards, revealing, or shuffling. | There is no exit-time cancellation, selector fallback, or rules-actor fallback. The session can contain player references that current validators require to be seated. |
| Solo Commander identity/tax | Solo `CardInstance` has physical `id`, zone-change counter, owner/controller, and `isCommander`; legacy `CommanderInfo` stores card ID and `castCount`; `commanderTax` is `2 * castCount`. Store paths expose command-zone choice handling around CR 903.9a and cast-from-command tax. | This is not the Core Registry's Commander model. There is no Core Commander designation/cast-count/replacement record, and no evidence that legacy `CommanderInfo` is a safe cross-player identity. |
| Solo Commander damage / defeat | `GameState.commanderDamage` is a `Record<string, number>` keyed by opponent Commander label. `adjustCommanderDamage` accepts a label and delta. SBA processing creates an append-only `DefeatAdvisory` for local `P1` when any value reaches 21. The advisory does not remove a player, end the game, or clean up objects. | It cannot represent damage from a specific physical Commander to a specific recipient player in a four-player game. It also conflates no explicit exit with an advisory-only defeat path unless O4P-01M chooses a new boundary. |
| Solo combat | Current `CombatState` has one `defendingPlayerId`, attackers with targets, blockers, and object/controller snapshots. Current commands are `enterCombat`, `declareAttackers`, `declareBlockers`, and `resolveCombatDamage`; multi-blocker damage emits `manual-combat-damage` and does not claim full automation. | The current path is not a multiplayer attack-assignment model. It does not define multiple defending players, target removal on exit, CR 506.4 combat removal through O4P-01L control, or 800.4e assignment behavior. |
| Solo player state/store | `PlayerState` contains life, poison, mana and per-turn counters but no `status`, `connected`, `left`, `conceded`, or `defeated` field. `GameCommand` and `GameStore` expose no player-exit, concession, or disconnect operation. | There is no existing state machine to reuse as an O4P-01M fact. Adding one would be a contract/state decision, not a mechanical integration detail. |
| Events / snapshots | Existing events include zone change, defeat advisory, damage, life change, draw, and attack declaration. Snapshots preserve the current Solo state and backfill legacy fields. O4P-01I/J/K/L are pure structural Core slices and do not add command/event/projection protocol metadata. | There is no player-left or concession event in the current Solo vocabulary, and O4P-01N owns typed Core command/event/replay closure. O4P-01M must not invent a wire/replay contract while grounding this state boundary. |
| Solo / Online boundary | O4P-01H through L review tests and architecture verifiers preserve Solo and keep Online, UI, WebSocket, Cloudflare, clock, and randomness out of the additive Core slices. | Disconnect has no current Core or Solo game meaning. A transport disconnect cannot be inferred from absent activity, and no network lifecycle is available in this milestone. |

## 4. Exact gaps

### GAP-M-01 — Player lifecycle semantics are absent

The current state has no distinction among a seated player, a player who has
lost by an SBA, a player who conceded, a player who has left after defeat, and a
transport that is merely disconnected. The ledger asks for “player exit” and
“concession,” but no active contract chooses the minimum state representation.

### GAP-M-02 — Concession and defeat have different causes but one downstream CR exit

Concession is immediate and voluntary under CR 104.3a/405.6g/723.6. Defeat is
normally an SBA condition under CR 104.3b-d, 104.3j, and 704.3/704.5. In
multiplayer, an enforced loss leads to the CR 800.4 player-leaves-game cleanup;
the existing Solo implementation instead records an advisory and remains
playable. The current code therefore cannot be treated as an implementation of
the full multiplayer exit consequence.

### GAP-M-03 — Disconnect has no game-state meaning

No current production source exposes a player connection or disconnect state.
The ledger explicitly says disconnect is distinct from player exit. There is no
evidence for treating a timeout, transport loss, browser close, or missing
command as concession, defeat, or CR 800.4 exit.

### GAP-M-04 — Registry membership and departed-player references conflict

Current Core validators use `turnOrder`/`players` as the seated player set and
require player references to be present. CR 800.4 cleanup, however, leaves
historical stack/target information useful while removing objects and making a
player no longer eligible for future actions. The report found no authoritative
choice between retaining an identity record with reduced eligibility and
removing it from the registry while preserving historical references.

### GAP-M-05 — Exit cleanup is not specified as one cross-slice transition

The CR ordering for owned objects, non-card stack objects, controlled objects,
control effects, choices, linked references, and priority is not represented by
G/H/I/J/K/L. A partial cleanup could leave invalid object IDs, dangling source
effects, or a priority window whose pass chain contains a departed player.

### GAP-M-06 — Active player, turn order, priority, and cleanup are coupled

O4P-01K's validators assume all lifecycle player IDs are seated and all pass
chains rotate over `turnOrder`. CR 800.4j permits a turn to continue without its
active player and specifies the next remaining player/stack boundary. No exact
normalization for an exit during active priority, a turn-based action, cleanup,
or a pending trigger order is shipped.

### GAP-M-07 — Stack owner/controller exit behavior is absent

O4P-01I/J distinguish card ownership, spell/ability controller, and historical
target references, but do not apply CR 800.4a to card spells, spell copies,
activated abilities, or triggered abilities. The special “non-card stack object
ceases” branch must not be approximated by generic object deletion.

### GAP-M-08 — Control and Decision Authority fallback is absent

O4P-01L intentionally keeps control, continuity, controlled player, and
decision maker distinct. It does not say what happens if any of those players
leaves. CR 800.4g/h supplies different directions for controller choices and
rule-required choices; a single “next player decides” rule would be an
unapproved semantic expansion.

### GAP-M-09 — Search/visibility exit behavior is absent

Search sessions are snapshots with explicit actor/selector separation and
stale-snapshot rejection. No rule says whether an open search is cancelled,
retained for a remaining selector, or completed by a fallback when either named
player leaves. Visibility grants also have no exit-time audience policy.

### GAP-M-10 — Commander identity and damage are not cross-player Core facts

The legacy implementation has a physical-card-like local Commander record and a
label-keyed damage map, but not a recipient/Commander identity pair. CR 903.3,
903.8, 903.9, and 903.10a require those distinctions. Commander replacement is
also a choice at a zone-change/SBA boundary, not merely a destination string.

### GAP-M-11 — Current combat is guided Solo combat, not multiplayer assignment

The current shape has one defending player and a manual multi-blocker warning.
It does not establish the multiplayer attack/defend relationship, exit-time
assignment pruning, control-change removal, or commander-damage source tracking.
The ledger allows guided/manual combat damage, but it does not waive combat
assignment and player-exit semantics.

### GAP-M-12 — Command/event/replay ownership is not yet available

The current code has legacy commands/events, while O4P-01N is the ledger owner
for typed Core commands/events, actor/decision-maker envelopes, deterministic
randomness, replay, and four-player headless closure. O4P-01M needs a bounded
semantic contract without silently establishing those later surfaces.

## 5. Proposed bounded contract questions

These are `PROPOSAL` questions for judge/user adjudication. They are not facts,
API commitments, or implementation instructions.

### Q-M-01 — What is the minimum lifecycle record?

**Question:** Should O4P-01M represent a player who has left as a retained
historical identity with an explicit non-eligible lifecycle state, or remove the
player from the active Registry while retaining only the historical references
needed by stack/events/replay?

**Bounded acceptance:** whichever choice is selected must state the legal player
set, owner/controller reference rules, private-zone treatment, snapshot
round-trip behavior, and the invariant for “no remaining opponent” under CR
104.2a. It must not add connection metadata.

### Q-M-02 — How are concession, defeat, and exit causally ordered?

**Question:** Is concession recorded as a distinct cause that immediately invokes
the CR 800.4 cleanup, while an SBA defeat remains an advisory in the existing
Solo sandbox unless an explicit enforcement boundary is selected?

**Bounded acceptance:** a contract must distinguish at least:

- explicit concession by the affected player;
- an observed defeat condition and its CR rule reference;
- an enforced loss/player-leaves-game consequence; and
- an unrelated transport disconnect.

It must preserve CR 723.6: a player-controller cannot concede for the controlled
player.

### Q-M-03 — What does disconnect mean in this milestone?

**Question:** Should O4P-01M define no Core game-state transition for disconnect,
leaving reconnect/seat policy entirely to the later multiplayer/session lane?

**Bounded acceptance:** no timeout, missing command, WebSocket close, browser
close, or transport error may be treated as concession, defeat, or 800.4 exit
without a later explicit policy. No `connected` field belongs in this Core
contract unless separately authorized.

### Q-M-04 — What is the atomic CR 800.4 cleanup order?

**Question:** In one pure state transition, what exact order applies to owned
objects, non-card stack objects, controlled objects, control effects, player
choices, linked exiles, combat assignments, and current priority?

**Bounded acceptance:** the answer must cover card vs non-card stack objects,
objects controlled but not owned, source effects, attachments, pending triggers,
and no partial candidate on failure. It must preserve G's new-object/LKI
distinction and J's atomic-bundle boundary.

### Q-M-05 — How are active player and priority normalized after exit?

**Question:** Should seat order remain a stable order while eligibility is
computed separately, or should the active Registry player order itself change?
How are current holder, passed IDs, cycle start, cleanup player, trigger-order
recipient, and a turn whose active player left normalized?

**Bounded acceptance:** the contract must directly cover CR 800.4a/800.4j and
O4P-01K's seated/contiguous-pass invariants. It must define the zero/one
remaining-player boundary and the CR 104.2a game-end condition without relying
on UI iteration.

### Q-M-06 — How are control and decision authorities repaired?

**Question:** When the departed player is an effect source, gaining controller,
controlled player, or decision maker, which records end, which are retained as
historical data, and who makes a rule-required choice under CR 800.4g/h?

**Bounded acceptance:** no generic fallback may grant control of objects or
resources. The result must preserve O4P-01L's distinction between object
controller, controlled player, decision maker, and active player.

### Q-M-07 — What happens to open search and visibility records?

**Question:** Does a search session cancel when its rules actor or selector
leaves, or is there a narrowly specified remaining-player fallback? Are
visibility grants revoked, retained, or re-evaluated for the remaining audience?

**Bounded acceptance:** no cancellation may move, shuffle, reveal, or select a
card implicitly. A stale snapshot must remain rejected; an exit must not widen
private information.

### Q-M-08 — What is the Commander identity/damage contract?

**Question:** What physical-card and incarnation relation records Commander
designation, command-zone cast count/tax, 903.9a-b replacement decisions, and
21 damage from one Commander to one recipient across multiple opponents?

**Bounded acceptance:** damage must be addressable by recipient and Commander
identity, not a display label; Commander designation must survive the zones
required by CR 903.3; replacement choice must remain distinct from ordinary zone
transition. Legacy Solo `CommanderInfo`/label maps cannot be assumed to be the
Core shape.

### Q-M-09 — What combat subset is required?

**Question:** Which multiplayer attack/defend/assignment facts must be automatic
in O4P-01M, and which may remain guided/manual under the ledger boundary?

**Bounded acceptance:** even with manual damage, the contract must state
attacking player, defending player(s), attacker/blocker object identity,
controller changes, player exit before damage assignment, 800.4e, and
506.4 removal. Full Oracle legality and full automatic damage distribution may
remain explicitly deferred.

### Q-M-10 — What state boundary is handed to O4P-01N?

**Question:** Which semantic lifecycle facts are frozen in M, while typed
commands/events, result envelopes, actor/decision-maker protocol, replay, and
deterministic randomness remain N-owned?

**Bounded acceptance:** M must be testable as pure immutable state/transition
semantics without adding a wire format, UI projection, WebSocket behavior, or
replay claim.

## 6. Explicit DEFER list

The following are intentionally not claims of O4P-01M completion:

- WebSocket, transport disconnect, reconnect, room, authentication, seat
  capability, Cloudflare, Online runtime, UI, and projection behavior.
- Treating disconnect, timeout, browser close, or inactivity as concession,
  defeat, or player exit.
- Typed Core command/event/result envelopes, protocol revisions, replay,
  deterministic randomness, correction, and four-player headless closure owned
  by O4P-01N.
- Full CR 613 continuous-effect dependency evaluation and a general Oracle
  legality evaluator.
- Full mana/payment/cost enforcement, target legality, protection/hexproof,
  and generalized replacement-effect automation.
- Full automatic combat-damage distribution. Guided/manual damage is explicitly
  allowed, but the player/assignment/exit boundary is not silently dropped.
- UI presentation of defeated, conceded, left, or disconnected players.
- Any automatic fallback that delegates concession or outside-the-game choices
  through O4P-01L Decision Authority.
- Treating the existing Solo defeat advisory as a complete multiplayer
  player-leaves-game implementation.
- Replacing or widening the six-field O4P-01L authority bundle, or integrating
  O4P-01G through L into Solo/Online as part of grounding.

## 7. Negative guarantees for the next contract review

The next judge-owned contract should reject these interpretations explicitly:

1. `disconnect == concession` or `disconnect == defeat`.
2. `concession == defeat advisory`.
3. `defeat advisory == completed CR 800.4 cleanup`.
4. `controller of a player can concede for that player`.
5. `owner == controller == decision maker == active player` by default.
6. Deleting a departed ID from `turnOrder` while leaving K's priority/pass
   records unchanged.
7. Removing every object that references a departed player as if all references
   were owned objects; CR 800.4 distinguishes owner, controller, and non-card
   stack objects.
8. Automatically widening visibility or completing a search when a participant
   leaves.
9. Using a Commander display label as the source identity for 903.10a damage.
10. Claiming multiplayer combat automation merely because the existing Solo
    single-defender flow can be guided through a UI.

## 8. Evidence inventory

### Governance and authority

- `AGENTS.md`
- `docs/judge-protocol.md`
- `docs/contracts/manifest.json`
- `docs/contracts/engine/state-and-invariants.md`
- `docs/contracts/engine/commands-and-transactions.md`
- `docs/contracts/engine/zones-events-and-lki.md`
- `docs/contracts/engine/turn-priority-and-stack.md`
- `docs/contracts/engine/multiplayer.md`
- `.claude/loop-state.md`
- `research/cr-grounding/cr-backbone-ledger.json`
- `research/cr-grounding/o4p-01-to-05-rebaseline-2026-08-10.draft.md`

### Pinned CR sections

- `104`, `109`, `110`, `117`, `400`, `405`
- `500` through `514`
- `704`
- `723.3` through `723.6`
- `800.4`
- `903.2` through `903.10`

Source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, local pinned
ruleset `2026-06-19`.

### Shipped O4P-01G through O4P-01L evidence inspected

- O4P-01G: `src/engine/core/transition/**`, transition tests, the O4P-01G
  zone-transition grounding matrix, and
  `scripts/checks/verify-mode-neutral-core-zone-transition.ts`.
- O4P-01H: `src/engine/core/object/**`, registry/runtime tests and review tests,
  `research/cr-grounding/o4p-01h-universal-object-registry.contract.draft.md`,
  and `scripts/checks/verify-mode-neutral-core-object-registry.ts`.
- O4P-01I: `src/engine/core/stack/**`, announcement tests/review tests,
  `research/cr-grounding/o4p-01i-stack-announcement.contract.draft.md`, and
  `scripts/checks/verify-mode-neutral-core-stack-announcement.ts`.
- O4P-01J: `src/engine/core/stack/transaction/**`, transaction tests/review
  tests, `research/cr-grounding/o4p-01j-atomic-stack-transaction.contract.draft.md`,
  and `scripts/checks/verify-mode-neutral-core-stack-transaction.ts`.
- O4P-01K: `src/engine/core/turn/**`, turn/priority tests and review tests,
  `research/cr-grounding/o4p-01k-turn-priority-lifecycle.contract.draft.md`,
  and `scripts/checks/verify-mode-neutral-core-turn-priority.ts`.
- O4P-01L: `src/engine/core/rules/**`, rule-authority tests/review tests,
  `research/cr-grounding/o4p-01l-control-access-authority.contract.draft.md`,
  `src/test/architecture/review.o4p-01l-rule-authority-boundary.test.ts`, and
  `scripts/checks/verify-mode-neutral-core-rule-authority.ts`.

### Existing Solo evidence inspected

- `src/engine/types.ts`
- `src/engine/commands.ts`
- `src/engine/commander.ts`
- `src/engine/init.ts`
- `src/store/gameStore.ts`
- `src/store/__tests__/review.903-10a.test.ts`
- `src/store/__tests__/review.combat.test.ts`
- `src/store/__tests__/review.mp-state.test.ts`
- `src/store/__tests__/review.mp-four-player.test.ts`

No production, test, contract, ledger, loop-state, package, or git file was
changed by this grounding lane other than this draft.
