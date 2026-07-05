# Tier-1 adversarial audit: cr-102-players (S-ZONES §34.17 implementation)

Auditor: independent Tier-1 (cold session, no prior context). Scope: uncommitted
working-tree diff implementing `zonesByPlayer` per §34.17. Findings only — no
docs/review.*/source files modified as part of this audit.

## 4-check results

1. `npm run lint` — **PASS** (0 errors/warnings, eslint exits clean, no output).
2. `npx tsc --noEmit` — **PASS** (no output, exit clean).
3. `npx vitest run` — **PASS**. 147 test files, 1319 tests, all passed. No failing test.
4. `npm run build` — **PASS**. `tsc -b && vite build` succeeded (77 modules
   transformed, `dist/` produced, only a pre-existing "chunk >500kB" advisory
   warning, unrelated to this slice). `dist/` deleted after the check per
   instructions.

**No BLOCKER findings that fail one of the four mechanical checks.** However, one
HIGH-severity contract-consistency defect was found in the sync-completeness probe
(see below), plus a second HIGH-severity latent-defect finding (I18/I19 owner
misrouting), and several MEDIUM/LOW notes.

---

## HIGH-1: `performStateBasedActions` (exported, `src/engine/commands.ts:1749-1753`) does not sync `zonesByPlayer.P1`

**Adversarial claim under test**: "every code path that can produce/mutate a
`GameState` re-derives `zonesByPlayer.P1` before the state becomes visible to
consumers or is persisted."

**Evidence**:
```
src/engine/commands.ts:1749
export function performStateBasedActions(state: GameState): ApplyResult {
  const draft = makeDraft(state);
  stabilizeBeforePriority(draft);
  return { state: draft.state, warnings: draft.warnings };   // <-- no sync
}
```
Compare to the pattern used in every other `ApplyResult`-returning function that
was touched in this diff (`applyCommand` at `commands.ts:4022`,
`returnLinkedExileToBattlefield` at `commands.ts:3685`,
`consumeLinkedExileForSource` at `commands.ts:3697/3703/3714/3718`), all of which
now wrap their return value in `syncP1ZonesByPlayerFromFlatZones(draft.state)`.
`performStateBasedActions` was left out.

`stabilizeBeforePriority` (the function it calls) runs the CR 704.3 SBA loop,
which **does** mutate flat zones — e.g. CR 704.5g (0-toughness creature dies →
`battlefield` → `graveyard` via `moveCardInternal`/`deleteCardFromState`+
`setCard`/`insertIntoZone`, see `commands.ts:836-920` and the `704.5d` token-cease
path visible in the diff context around `commands.ts:1700-1710`). So a real
mutation of `zones.graveyard`/`zones.hand`/`zones.library` can happen inside
`performStateBasedActions` without the P1 mirror being resynced afterward.

**Reachability today**: `performStateBasedActions` is called from exactly one
place, `applySbaAndCollectTriggers` in `src/engine/priority.ts:302-311`, which is
in turn only reachable via `advanceToPriority` (`priority.ts:336`) and
`placePendingTriggersOnStackAsBatch` (`priority.ts:313`, which itself calls
`applyCommands`→`applyCommand`, so **that** path IS resynced on its own object,
but `applySbaAndCollectTriggers`'s direct SBA state is not). Grepping the whole
`src/` tree, `advanceToPriority` is imported **only** by
`src/engine/__tests__/priority.test.ts` — `src/store/gameStore.ts` imports just
`orderPendingTriggersApnap`/`triggerStackPlacementBucketOf` from `priority.ts`,
not `advanceToPriority` or `performStateBasedActions`. So **today, in the
production store, this exact stale path is not exercised** — it is dead-ish from
the store's perspective. But:
- It is a **public, exported** function (`export function performStateBasedActions`),
  part of the engine's command surface, and the sync helper's own doc-intent
  ("resync after `applyCommand` returns") implies it should cover all
  state-producing exits, not just the ones currently wired into the store.
- `priority.ts`'s own test file exercises it directly and asserts on `.state`
  (see `priority.test.ts:246/257/270`), so any future wiring of
  `advanceToPriority` into the store (a very plausible next step, since it exists
  specifically to drive priority/SBA/trigger flow) would silently inherit a stale
  `zonesByPlayer.P1` the moment SBA processing moves a card.

**Verdict**: this is exactly the "sync after the one function I remembered"
incomplete-refactor pattern the audit brief called out. It does **not** currently
cause an observable bug in the shipped store (no BLOCKER), because the vulnerable
function isn't wired into `gameStore.ts` yet. But it **does** contradict the
implementer's stated invariant ("resynced after `applyCommand` returns and after
snapshot normalize" — this is a third GameState-producing exit point that was
missed) and leaves a live landmine for the next slice that wires
`advanceToPriority`/`performStateBasedActions` into the store. Rated **HIGH**
(not BLOCKER) because it is a real, demonstrable gap in sync completeness, but
currently unreachable from the shipped store surface — round it up to BLOCKER
if any future slice starts calling `performStateBasedActions` or
`advanceToPriority` from `gameStore.ts` without first adding a sync call.

**Contract reference**: contradicts the spirit of §34.17 fork decision #4
("progressive migration... flat as P1 mirror") and I20 (P1 mirror consistency)
as stated in the design draft's invariant list — I20 says P1 mirror should hold
"after any command application," and `performStateBasedActions` is a
command-adjacent, state-producing operation not covered.

---

## HIGH-2: flat private zones are not owner-partitioned — opponent-owned cards silently get mirrored into `zonesByPlayer.P1` (I18/I19 latent violation)

**Adversarial claim under test**: "does an opponent-owned card that lands in the
flat `zones.graveyard` array via existing card-move logic get incorrectly
mirrored into `zonesByPlayer.P1` instead of routed to `zonesByPlayer.OPPONENT_A`?"

**Evidence this scenario is real, not hypothetical**: existing (pre-slice) test
fixtures explicitly create opponent-owned cards in the flat graveyard:
```
src/engine/__tests__/review.cr400-408-return.test.ts:48-55  (withOwner helper)
src/engine/__tests__/review.cr400-408-return.test.ts:98
    state = withOwner(state, 'c4', 'OPPONENT_A');
...
    state = move(state, 'c4', 'graveyard');   // moveCard -> flat zones.graveyard
```
`move()` here is `applyCommand(state, { type: 'moveCard', ... })`, and
`moveCardInternal` (`src/engine/commands.ts:836-920`) does:
```
removeFromCurrentZone(draft, cardId);
const dest = editZone(draft, to);
insertIntoZone(dest, cardId, effectivePosition);
```
`editZone`/`insertIntoZone` operate on the single shared `zones[to]` array with
**no owner-based branching or filtering** — any card, regardless of `ownerId`,
that moves `to: 'graveyard'|'hand'|'library'` lands in the same flat array.

Then `playerPrivateZonesFromFlatZones` (`src/engine/types.ts:531-538`) and its
caller `zonesByPlayerWithP1Mirror`/`syncP1ZonesByPlayerFromFlatZones`
(`types.ts:540-563`) copy the **entire flat array verbatim** into
`zonesByPlayer.P1`, with no `ownerId === 'P1'` filter:
```ts
export function playerPrivateZonesFromFlatZones(
  zones: Pick<Record<ZoneId, string[]>, PrivateZoneId>,
): PlayerPrivateZones {
  return {
    library: zones.library.slice(),
    hand: zones.hand.slice(),
    graveyard: zones.graveyard.slice(),
  };
}
```
So in the `review.cr400-408-return.test.ts` Karmic Guide scenario, card `c4`
(`ownerId: 'OPPONENT_A'`, sitting in the flat `zones.graveyard` array) would, if
`syncP1ZonesByPlayerFromFlatZones` ran on that state, be copied into
`zonesByPlayer.P1.graveyard` — a P1-owned-zone bucket containing an
opponent-owned card. This is simultaneously:
- an **I18 violation** (private-zone owner routing consistency — `c4`'s owner is
  `OPPONENT_A` but it's routed into `P1`'s bucket), and
- a **potential I19 violation** if `OPPONENT_A`'s own `zonesByPlayer.OPPONENT_A`
  bucket ever independently gained the same card id from another source (not
  observed in current code, since `OPPONENT_A` is always initialized/kept empty
  — so today it's a routing/attribution bug rather than an observed duplicate
  membership, but the *card is simply missing from `zonesByPlayer.OPPONENT_A`
  and wrongly present in `zonesByPlayer.P1`* instead).

**Why this rates HIGH and not BLOCKER**: the frozen §34.17 design's own text
constrains this precisely — fork decision #2 says opponent is "first class
`PlayerId`" but the current engine's flat zones are, by the design doc's own
admission, a **legacy single shared array with no owner partition**, and the
backfill-regulation clause explicitly says "混在 owner の legacy を restore 時に
CR400.3 修復しない(次の zone-change command が強制)" — i.e., the frozen spec
*already anticipated* that mixed-owner legacy data would not be repaired at
backfill time, deferring correctness to "the next zone-change command." This
slice's own scope-boundary note explicitly excludes
"player-specific private zone owner metadata" from this implementation (it's
listed as a carry-forward). So this is arguably **within the accepted scope
boundary of §34.17** rather than a violation of it — but it means the
`zonesByPlayer.P1`-derivation approach is only correct in the *actual solo-mode
production code path* (where no card is ever really owned by `OPPONENT_A` in a
private zone; `OPPONENT_A` cards only appear via commander-damage/life-total
bookkeeping, not via genuine private-zone card ownership) and is **actively
wrong** the moment any card-in-flat-private-zone has `ownerId !== 'P1'` — which
existing test fixtures for other slices (cr-400-408) already demonstrate as a
constructible state. I19's disjointness invariant, as tested in
`zonesByPlayer.test.ts:60-77`, only checks disjointness on ordinary states
produced by `initGame`+`applyCommand` in the test file's own scenarios — it
never constructs a mixed-owner state, so **the test suite does not catch this
gap** (see Test-honesty finding below).

**Verdict**: real defect in the "derive P1 from flat unconditionally" strategy,
but pre-existing engine behavior (flat zones being owner-unaware) is the root
cause, not something newly introduced by this slice, and the frozen spec
appears to accept this as deferred/out-of-scope. Rated **HIGH** as a
documentation/test gap and correctness landmine, not BLOCKER.

---

## MEDIUM-1: spec text internally ambiguous on backfill priority when `zonesByPlayer` and flat coexist

`docs/engine-spec.md` §34.17 "backfill 規律" states:
> `zonesByPlayer.P1` と flat 併存時は `zonesByPlayer` **優先**で mirror 再構築。

Read literally, this says: when both exist, rebuild the mirror **giving priority
to the existing `zonesByPlayer` value**. But the actual implementation
(`syncP1ZonesByPlayerFromFlatZones`, used in `normalizeSnapshotState` at
`gameStore.ts:415-454`, `applyCommand`, etc.) does the **opposite**: it always
overwrites `zonesByPlayer.P1` from the flat `zones.*` arrays, discarding
whatever was previously stored in `zonesByPlayer.P1`. This matches fork decision
#1 ("flat continues as P1 mirror... not made independent from
`zonesByPlayer.P1`" — i.e., flat is the source of truth, mirror follows flat),
which is the clearer and more central frozen decision, so the implementation's
choice is defensible. But the "backfill 規律" sentence, taken at face value,
contradicts it. This is a spec self-consistency issue, not an implementation
bug — flagging per the audit brief's "CR reference if applicable, whether it
contradicts the frozen contract" requirement. Not adversarially actionable
against the implementer; worth a judge note to tidy the spec wording.

---

## MEDIUM-2: `zonesByPlayer.test.ts` does not cover the malformed-type snapshot case

Audit brief explicitly asked for a test constructing
`zonesByPlayer: { P1: { library: null, hand: undefined, graveyard: 'not-an-array' } }`
and confirming graceful `[]` fallback. `src/store/__tests__/zonesByPlayer.test.ts`
only covers:
- field completely absent (`withoutZonesByPlayer`, lines 111-141), and
- keys completely missing (`partialState` with only `library` key present, lines
  143-174).

It does **not** construct malformed *values* (null/undefined/wrong-primitive-type
for a present key). I independently verified the underlying code path handles
this correctly regardless (`isStringArray` in `gameStore.ts:353-355` correctly
guards `Array.isArray(value) && value.every(...)`, so `null`/`undefined`/a
string all fail the guard and fall back to `[]` via
`normalizePlayerPrivateZones`, `gameStore.ts:165-176`) — so this is a **test
coverage gap, not a code defect**. Rated MEDIUM because the brief specifically
asked for this exact adversarial case and the implementer-authored test doesn't
include it, even though the code happens to be correct.

---

## LOW-1: order-preservation round trip verified correct

Confirmed by reading `zonesByPlayer.test.ts:111-141`: it builds a state via
`initGame` + `draw(3)` + `mill(2)` (non-trivial, non-alphabetical card-id
ordering derived from a seeded shuffle), strips `zonesByPlayer`, restores via
`store().restoreGame(snapshot)`, and asserts
`restored.zonesByPlayer.P1.library` (etc.) `toEqual(legacyLibrary)` — an
order-sensitive `toEqual` on an array, which would fail on any reordering. This
satisfies the CR 401.1 top-card-order-matters concern. No defect found here.

## LOW-2: `priority.test.ts` change is mechanical only

Confirmed via `git diff -- src/engine/__tests__/priority.test.ts`: the only
change is (a) importing `emptyPlayerPrivateZones`/`playerPrivateZonesFromFlatZones`
as values alongside the existing type-only imports, and (b) adding a
`zonesByPlayer: { P1: playerPrivateZonesFromFlatZones(zones), OPPONENT_A:
emptyPlayerPrivateZones() }` field to the hand-constructed `GameState` literal in
`stateWithPendingTriggers` (line ~99-105). No existing assertion, expected value,
or test case was touched, added, or removed. This is a pure type-checking fix,
not a way to dodge testing something.

## LOW-3: determinism/purity of the P1-mirror derivation

`playerPrivateZonesFromFlatZones`/`cloneZonesByPlayer`/`clonePlayerPrivateZones`
(`src/engine/types.ts:508-563`) only ever do `.slice()` on already-ordered arrays
(`zones.library`/`hand`/`graveyard`, which are plain `string[]`, not objects
iterated via `Object.keys`/`Object.values`). `cloneZonesByPlayer` explicitly
enumerates the two known `PlayerId`s (`P1`, `OPPONENT_A`) by literal property
access, not by iterating an object's keys, so there's no
iteration-order-dependency risk. No purity/determinism defect found.

## LOW-4: scope discipline — no command was made player-aware beyond storage+sync

Grepped for any read of `state.zonesByPlayer` outside of `types.ts` (the sync
helpers themselves), `init.ts` (initialization), `commands.ts` (the sync calls),
`gameStore.ts` (normalize/backfill), and the new test file — found none. No
existing command (`moveCard`, `draw`, `mulligan`, etc.) reads from
`zonesByPlayer` as an alternate source of truth; all continue to read/write the
flat `zones.*` arrays exclusively. Scope discipline honored for this slice.

---

## Summary of severities

- BLOCKER: **0**
- HIGH: **2** (sync-completeness gap in `performStateBasedActions`; I18/I19
  owner-misrouting latent defect in flat-zone-derived P1 mirror)
- MEDIUM: **2** (spec self-consistency wording; missing malformed-type test case)
- LOW: **4** (order-preservation verified good; priority.test.ts change verified
  mechanical; determinism verified good; scope discipline verified good)
