# Tier-1 findings: cr-119-life S-EVENTS envelope

Date: 2026-07-02
Role: independent cold audit, findings only
Contract anchors: `docs/engine-spec.md` §34.18, `research/cr-grounding/s-events-life-envelope.draft.md`, `src/store/__tests__/review.s-events-envelope.test.ts`
CR anchors: 119.3, 119.9, 119.10, 120.1, 120.8, 121.1, 121.2, 121.4, 121.5, 400.6, 400.7, 614.1, 615.1, 104.3b, 704.5a, 704.5b

## Machine Checks

Summary: `npm run lint` FAIL, `npx tsc --noEmit` PASS, `npx vitest run` PASS, `npm run build` FAIL. `review.s-events-envelope.test.ts` is behaviorally green in Vitest (12/12), but the reviewer-owned file currently breaks lint/build via a bad `GameCommand` import.

### `npm run lint`

Exit code: 1

```text
> mtg-onedeck@0.0.0 lint
> eslint .


/Users/shumpeiabe/Desktop/MTG_OneDeck/src/store/__tests__/review.s-events-envelope.test.ts
  194:35  error  Unsafe argument of type error typed assigned to a parameter of type `GameCommand`  @typescript-eslint/no-unsafe-argument
  195:35  error  Unsafe argument of type error typed assigned to a parameter of type `GameCommand`  @typescript-eslint/no-unsafe-argument
  200:36  error  Unsafe argument of type error typed assigned to a parameter of type `GameCommand`  @typescript-eslint/no-unsafe-argument
  201:36  error  Unsafe argument of type error typed assigned to a parameter of type `GameCommand`  @typescript-eslint/no-unsafe-argument

✖ 4 problems (4 errors, 0 warnings)
```

### `npx tsc --noEmit`

Exit code: 0

```text
```

### `npx vitest run`

Exit code: 0

```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  104 passed (104)
      Tests  1121 passed (1121)
   Start at  15:19:04
   Duration  15.22s (transform 2.82s, setup 2.77s, import 7.93s, tests 16.31s, environment 63.21s)
```

### `npm run build`

Exit code: 2

```text
> mtg-onedeck@0.0.0 build
> tsc -b && vite build

src/store/__tests__/review.s-events-envelope.test.ts(21,15): error TS2305: Module '"../../engine/types"' has no exported member 'GameCommand'.
```

`dist/` check after failed build:

```text
find: dist: No such file or directory
```

### Supplemental Test Evidence

`review.s-events-envelope.test.ts` 12 pin:

```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  1 passed (1)
      Tests  12 passed (12)
   Start at  15:19:29
   Duration  588ms (transform 141ms, setup 20ms, import 160ms, tests 8ms, environment 324ms)
```

Existing zoneChange / defeat / combat compatibility:

```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  3 passed (3)
      Tests  23 passed (23)
   Start at  15:21:00
   Duration  675ms (transform 338ms, setup 66ms, import 427ms, tests 24ms, environment 1.21s)
```

## Diff / Provenance Evidence

`git diff --name-only`:

```text
docs/engine-spec.md
research/cr-grounding/cr-backbone-ledger.json
src/engine/commands.ts
src/engine/types.ts
```

`git status --short --untracked-files=all`:

```text
 M docs/engine-spec.md
 M research/cr-grounding/cr-backbone-ledger.json
 M src/engine/commands.ts
 M src/engine/types.ts
?? research/cr-grounding/s-events-life-envelope.draft.md
?? research/cr-grounding/s-events-life-golden.draft.md
?? src/engine/__tests__/eventEnvelope.test.ts
?? src/store/__tests__/review.s-events-envelope.test.ts
```

`git diff --name-only -- src/**/__tests__/review.* docs research/cr-grounding/cr-backbone-ledger.json research/cr-grounding/golden-cases.json`:

```text
docs/engine-spec.md
research/cr-grounding/cr-backbone-ledger.json
```

## Findings

### F-0: Machine gate is red

Severity: BLOCKER
Status: RED
CR refs: 119.3, 119.9, 119.10, 120.1, 120.8, 121.1, 121.2, 121.4, 121.5 (acceptance surface); direct failure is TypeScript/lint, not CR semantics.
Evidence: `src/store/__tests__/review.s-events-envelope.test.ts:21` imports `GameCommand` from `../../engine/types`, but `GameCommand` is exported from `src/engine/commands.ts:44`. This causes lint unsafe-argument errors at `src/store/__tests__/review.s-events-envelope.test.ts:194`, `:195`, `:200`, `:201` and build error TS2305.
Impact: Required 4-check gate is not green. Implementation cannot ship regardless of Vitest passing.

### F-1: Protected-file provenance is not clean from this cold session

Severity: HIGH
Status: RED FLAG
CR refs: n/a governance; affected contract anchors cite 119/120/121/400.6/400.7/614/615.
Evidence: `git diff --name-only` includes `docs/engine-spec.md` and `research/cr-grounding/cr-backbone-ledger.json`; `git status` also shows untracked `src/store/__tests__/review.s-events-envelope.test.ts`. Relevant locations: `docs/engine-spec.md:2403` starts §34.18, `research/cr-grounding/cr-backbone-ledger.json:195` changes `cr-119-life`, `src/store/__tests__/review.s-events-envelope.test.ts:1` marks the review file as reviewer-owned.
Assessment: If these files are Fable-authored, this is legitimate per the brief. This audit cannot prove authorship from the worktree alone. Treat as a provenance red flag until Fable explicitly re-owns the docs/ledger/review artifacts.

### F-2: Damage scope stayed inside the promised boundary

Severity: NONE
Status: GREEN
CR refs: 120.1, 120.8.
Evidence: `DamageEvent` is added to the union at `src/engine/types.ts:199` and `src/engine/types.ts:291`. `pushEvent` has a generic damage branch at `src/engine/commands.ts:323`, but grep found no current emission payload with `type: 'damage'` outside type definitions and that branch. Source-less `markDamage` mutates only marked damage/logs at `src/engine/commands.ts:787`; combat player damage emits life deltas only at `src/engine/commands.ts:953`.
Assessment: No source-backed `DamageEvent` was mixed into markDamage/combat. This respects the CR120.1 source boundary and the §34.18 defer.

### F-3: Zero boundaries are respected

Severity: NONE
Status: GREEN
CR refs: 119.9, 119.10, 120.8.
Evidence: `pushLifeChangeEvent` returns before emission on `delta === 0` at `src/engine/commands.ts:523`. `applyMarkDamage` clamps amount and has no event emission at `src/engine/commands.ts:787`; zero marked damage does not even log at `src/engine/commands.ts:804`.
Assessment: `adjustLife { delta: 0 }` does not emit `lifeChange`; zero damage cannot emit a `damage` event because no damage emitter exists in this slice.

### F-4: Draw envelope behavior matches §34.18 pins

Severity: NONE
Status: GREEN
CR refs: 121.1, 121.2, 121.4, 121.5, 400.6, 704.5b.
Evidence: `drawCards` loops per individual draw at `src/engine/commands.ts:1495`; successful draws call `moveCardInternal` and pass its `ZoneChangeEvent` to `pushDrawEvent` at `src/engine/commands.ts:1504`. `pushDrawEvent` copies `zoneChangeEventId`, card ids, and snapshots at `src/engine/commands.ts:553`. Empty-library attempts emit `result: 'empty-library-attempt'` without card fields at `src/engine/commands.ts:1499`. Mill uses `moveCardInternal` only and never calls `pushDrawEvent` at `src/engine/commands.ts:1514`.
Assessment: Successful draw links to library->hand zoneChange; empty draw attempt has no card identity; multi-draw is individual; mill emits no draw.

### F-5: I14 event determinism is satisfied for inspected paths

Severity: NONE
Status: GREEN
CR refs: 400.6/400.7 as event identity context; I14 is project invariant.
Evidence: `makeDraft` derives `nextEventSeq` from existing `eventLog` max sequence at `src/engine/commands.ts:228`; `pushEvent` assigns `eventId = e${sequence}` deterministically at `src/engine/commands.ts:292`. No Date/RNG use was found in `src/engine`; `Math.random` hits are store seed/dice/coin UI paths, not `applyCommand`.
Assessment: Same state plus same command yields the same appended event ids/order for the inspected life/draw paths. Review pin 12 and implementation test both passed.

### F-6: Forward compatibility and schema discipline look intact

Severity: NONE
Status: GREEN
CR refs: 400.6, 400.7.
Evidence: `GameState` did not gain a new required field; current state shape still has `eventLog: GameEvent[]` at `src/engine/types.ts:369`. `restoreGame`/snapshot normalization backfills missing `eventLog` to `[]` at `src/store/gameStore.ts:314`. `CACHE_SCHEMA_VERSION` remains `3` at `src/data/cache.ts:9`.
Assessment: This is an additive union extension. Legacy missing `eventLog` restores to `[]`; no cache schema bump was made.

### F-7: Review pin content is behaviorally green but provenance/build validity is red

Severity: HIGH
Status: RED FLAG
CR refs: 119.3, 119.9, 119.10, 120.1, 120.8, 121.1, 121.2, 121.4, 121.5, 400.6, 400.7.
Evidence: `src/store/__tests__/review.s-events-envelope.test.ts:51` defines the 12-pin suite and the targeted Vitest run reports `Tests 12 passed (12)`. However the file is untracked in `git status`, so `git diff` cannot prove it was not authored/weakened by an implementation session. The same file also breaks lint/build via `src/store/__tests__/review.s-events-envelope.test.ts:21`.
Assessment: The behavioral assertions are not weakened in the observed file, but audit provenance and machine-check validity are not ship-clean.

### F-8: LifeChange payload correctness is green for the current model

Severity: NONE
Status: GREEN
CR refs: 119.3, 119.4, 104.3b, 704.5a.
Evidence: P1 life deltas capture previous/next totals at `src/engine/commands.ts:844`; event direction is derived from signed delta at `src/engine/commands.ts:528`. Opponent life uses the existing `OPPONENT_A` player bridge plus `lifeLabel` at `src/engine/commands.ts:853`. Review pins verify gain/loss totals at `src/store/__tests__/review.s-events-envelope.test.ts:56` and advisory-only continuation at `src/store/__tests__/review.s-events-envelope.test.ts:91`.
Assessment: previousLife/nextLife/direction/playerId are correct within the current `PlayerId = P1 | OPPONENT_A` model. Life <= 0 remains advisory-only and does not hard-enforce game end.

## SHIP Recommendation

Do not ship yet.

Reasons:

- BLOCKER: required 4-check gate is not green (`npm run lint` and `npm run build` fail).
- HIGH provenance red flag: protected docs/ledger and reviewer-owned review pin are present in the worktree; this may be legitimate Fable work, but it needs explicit Fable re-ownership before ship.
- Behavior is otherwise green in Vitest: full suite 1121/1121, S-EVENTS 12/12, supplemental zoneChange/defeat/combat 23/23.
