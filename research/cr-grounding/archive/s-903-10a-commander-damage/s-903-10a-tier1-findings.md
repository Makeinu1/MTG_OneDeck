# S-903.10a Tier-1 Independent Audit Findings

Audit target: S-903.10a commander-damage defeat advisory. Scope is findings-only; no contract or `review.*` files were modified by this audit.

## Machine Checks

### 1. `npm run lint` - PASS

Raw result:

```text
> mtg-onedeck@0.0.0 lint
> eslint .
```

### 2. `npx tsc --noEmit` - PASS

Raw result:

```text
```

The command exited 0 with no stdout/stderr.

### 3. `npx vitest run` - PASS

Raw result:

```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  102 passed (102)
      Tests  1102 passed (1102)
   Start at  00:27:02
   Duration  16.84s (transform 3.79s, setup 3.02s, import 9.75s, tests 19.79s, environment 68.76s)
```

### 4. `npm run build` - PASS

Raw result:

```text
> mtg-onedeck@0.0.0 build
> tsc -b && vite build

vite v8.0.16 building client environment for production...
transforming...✓ 77 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.26 kB │ gzip:   0.55 kB
dist/assets/index-Cd1X7s80.css   73.12 kB │ gzip:  12.61 kB
dist/assets/index-BmlisryR.js   478.76 kB │ gzip: 142.75 kB

✓ built in 128ms
```

### Required Review-Test Confirmation - PASS

Raw result:

```text
 RUN  v4.1.8 /Users/shumpeiabe/Desktop/MTG_OneDeck


 Test Files  3 passed (3)
      Tests  24 passed (24)
   Start at  00:27:34
   Duration  1.58s (transform 433ms, setup 61ms, import 539ms, tests 885ms, environment 1.23s)
```

Command:

```text
npx vitest run src/store/__tests__/review.903-10a.test.ts src/store/__tests__/review.sba-defeat.test.ts src/engine/__tests__/review.properties.test.ts
```

This explicitly covers `review.903-10a.test.ts`, `review.sba-defeat.test.ts`, and `review.properties.test.ts` including I13.

## Raw Diff/Status Evidence

`git diff --name-only`:

```text
docs/engine-spec.md
research/cr-grounding/golden-cases.json
src/engine/__tests__/review.properties.test.ts
src/engine/commands.ts
src/engine/types.ts
src/store/__tests__/crGroundingGoldenCases.test.ts
src/store/__tests__/review.sba-defeat.test.ts
src/store/gameStore.ts
```

`git status --short` additionally shows:

```text
 M docs/engine-spec.md
 M research/cr-grounding/golden-cases.json
 M src/engine/__tests__/review.properties.test.ts
 M src/engine/commands.ts
 M src/engine/types.ts
 M src/store/__tests__/crGroundingGoldenCases.test.ts
 M src/store/__tests__/review.sba-defeat.test.ts
 M src/store/gameStore.ts
?? research/cr-grounding/s-903-10a-commander-damage.draft.md
?? research/cr-grounding/s-903-10a-golden.draft.md
?? src/store/__tests__/review.903-10a.test.ts
```

## Findings

### F-01 - Conditional Red Flag: Reviewer-Owned Files Are Present In The Worktree

Severity: HIGH if these changes are attributed to the implementation agent; otherwise green under the prompt's explicit Fable-owned exception. CR: n/a, project contract gate.

Evidence: `git diff --name-only` includes `src/engine/__tests__/review.properties.test.ts` and `src/store/__tests__/review.sba-defeat.test.ts`; `git status --short` also shows untracked `src/store/__tests__/review.903-10a.test.ts`.

Assessment: the prompt says Fable-owned `review.*` / `docs` edits are legitimate, while implementers may only touch engine/store/golden lanes. The worktree alone cannot prove authorship. If this is the combined Fable+implementation worktree, this is not an implementation defect. If any of these reviewer-owned files were authored by the implementer, SHIP should be blocked.

### F-02 - Green: No Meaningful Weakening Of Acceptance Assertions Found

CR refs: 903.10a, 104.3j, 702.124d, 704.3, 117.5.

Evidence:

- `src/store/__tests__/review.903-10a.test.ts:69` through `src/store/__tests__/review.903-10a.test.ts:202` pins 20/21 boundary, 20->21 transition, 10+11 non-aggregation, independent 21 label, idempotent fixed point, simultaneous grouping, advisory continuation, P1-only model boundary, ordinary life-loss boundary, and snapshot round-trip.
- `src/store/__tests__/review.sba-defeat.test.ts:184` through `src/store/__tests__/review.sba-defeat.test.ts:195` replaces the old deferred pin with a positive advisory-level 903.10a pin while preserving the per-opponent-exact negative boundary.
- `src/engine/__tests__/review.properties.test.ts:360` through `src/engine/__tests__/review.properties.test.ts:382` keeps I13 strict: advisory records must be non-empty, de-duplicated, drawn from known reasons, and carry the matching rule ref; it adds `commanderDamage -> 903.10a`.

No `toContain`/count/rule-ref assertion was loosened into an unverified shape in the reviewed changes.

### F-03 - Low Red Flag: Stale Header Comment In `review.sba-defeat`

Severity: LOW. CR refs: 903.10a, 104.3j.

Evidence: `src/store/__tests__/review.sba-defeat.test.ts:21` through `src/store/__tests__/review.sba-defeat.test.ts:22` still says commander damage 21 must not create a defeat advisory in this slice, but the actual test at `src/store/__tests__/review.sba-defeat.test.ts:184` through `src/store/__tests__/review.sba-defeat.test.ts:195` now correctly expects the advisory-level 903.10a behavior.

Assessment: not a behavioral weakening and not a failing test, but it is contradictory reviewer-owned acceptance documentation. Fable should clean it before final ownership/commit.

### F-04 - Green: No Scope Creep Into Deferred Commander-Damage Boundaries

CR refs: 903.10a, 702.124d.

Evidence:

- `src/engine/types.ts:291` remains `commanderDamage: Record<string, number>` keyed by free-text label.
- `src/engine/commands.ts:1077` through `src/engine/commands.ts:1081` only observes existing numeric label values.
- `src/engine/commands.ts:2474` through `src/engine/commands.ts:2480` preserves manual `adjustCommanderDamage` counter updates.
- No new per-opponent commander-damage matrix, commander `cardId` attribution, object identity attribution, dummy opponent player object, or combat auto-attribution was found in the implementation diff.

Assessment: advisory-level threshold detection stays within the contracted coarse label model.

### F-05 - Green: CR Citations Match Local CR Text

CR refs verified against `rule/Magic_The_Gathering_Comprehensive_Rules.txt`:

- `104.3j` at line 358: commander game, 21+ combat damage by same commander loses; SBA.
- `117.5` at line 960: priority boundary performs all applicable SBAs as a single event and repeats to fixed point.
- `702.124d` at line 4906: partner commanders are considered separately for the 21-damage check.
- `704.3` at line 5485: all applicable SBAs are simultaneous and checks repeat.
- `704.6c` at line 5546: Commander-game 21+ commander combat damage loss, points to rule 903.
- `903.10a` at line 6968: 21+ combat damage by the same commander loses; SBA.

Evidence in golden/test additions:

- `research/cr-grounding/golden-cases.json:1314` through `research/cr-grounding/golden-cases.json:1328` uses `903.10a` for the 20-point non-loss boundary.
- `research/cr-grounding/golden-cases.json:1331` through `research/cr-grounding/golden-cases.json:1350` uses `903.10a`, `104.3j`, `117.5`, `704.3`, and `104.5` for 21-point advisory behavior.
- `research/cr-grounding/golden-cases.json:1374` through `research/cr-grounding/golden-cases.json:1389` uses `702.124d` for non-aggregation.
- `research/cr-grounding/golden-cases.json:1429` through `research/cr-grounding/golden-cases.json:1444` uses `704.3` for simultaneous grouping.
- `src/store/__tests__/crGroundingGoldenCases.test.ts:1714` through `src/store/__tests__/crGroundingGoldenCases.test.ts:1733` executes the 903.10a threshold case and checks `ruleRefs.commanderDamage === '903.10a'`.

No CR mis-citation blocker found.

### F-06 - Green: Fixed-Point Idempotence Is Sound

CR refs: 704.3, 117.5, 903.10a.

Evidence:

- `src/engine/commands.ts:477` through `src/engine/commands.ts:506`: `addDefeatAdvisory` returns `false` without emitting when the reason already exists.
- `src/engine/commands.ts:1077` through `src/engine/commands.ts:1081`: the commander-damage branch calls `addDefeatAdvisory` for `P1` and breaks after finding a qualifying label.
- `src/engine/commands.ts:1092` through `src/engine/commands.ts:1094`: one `simultaneousGroupId` is created for the SBA pass.
- `src/engine/commands.ts:1149` through `src/engine/commands.ts:1152`: defeat-only passes return `true` only when a new advisory was added.
- `src/engine/commands.ts:1267` through `src/engine/commands.ts:1270`: the fixed-point loop repeats only while `performStateBasedActionsOnce` returns `true`.
- `src/store/__tests__/review.903-10a.test.ts:126` through `src/store/__tests__/review.903-10a.test.ts:135` pins no re-emit after held-over `>=21`.

Assessment: a persistent `commanderDamage[label] >= 21` does not create duplicate 903.10a events and cannot by itself cause an infinite SBA loop.

### F-07 - Green: Snapshot Forward-Compatibility Handles The New Reason And Drops Unknowns

CR refs: 903.10a.

Evidence:

- `src/store/gameStore.ts:88` through `src/store/gameStore.ts:93`: `DEFEAT_RULE_REFS` includes `commanderDamage: '903.10a'`.
- `src/store/gameStore.ts:222` through `src/store/gameStore.ts:228`: `isDefeatReason` treats `commanderDamage` as known.
- `src/store/gameStore.ts:235` through `src/store/gameStore.ts:260`: `normalizeSnapshotDefeat` skips unknown/duplicate reasons, rebuilds canonical `ruleRefs`, and preserves known commander-damage advisories.
- `src/store/__tests__/review.903-10a.test.ts:189` through `src/store/__tests__/review.903-10a.test.ts:202` pins commanderDamage snapshot round-trip with `903.10a`.

No forward-compat red flag found.

### F-08 - Green: No Multi-Label Summing Bug

CR refs: 903.10a, 702.124d.

Evidence:

- `src/engine/commands.ts:1077` through `src/engine/commands.ts:1081` iterates each `Object.values(commanderDamage)` value independently and tests `value >= 21`; it does not reduce/sum values.
- `src/store/__tests__/review.903-10a.test.ts:108` through `src/store/__tests__/review.903-10a.test.ts:115` pins 10+11 across two labels as no loss.
- `src/store/__tests__/review.903-10a.test.ts:117` through `src/store/__tests__/review.903-10a.test.ts:123` pins one label at 21 as sufficient even when a sibling label is below threshold.

Assessment: label aggregation is not present.

### F-09 - Green: Advisory Remains Non-Forcing

CR refs: 104.3j, 104.5, 903.10a.

Evidence:

- `src/engine/commands.ts:477` through `src/engine/commands.ts:506` records an advisory, warning, and log only; it does not null state, end the game, remove a player, or block commands.
- `src/store/__tests__/review.903-10a.test.ts:159` through `src/store/__tests__/review.903-10a.test.ts:170` pins state remains truthy, phase movement is not blocked by the advisory, and the advisory persists append-only after the counter drops below 21.
- Search found no commander-damage-specific `gameOver`, winner selection, player-leaving, state clearing, or command-blocking path.

Assessment: the implementation preserves the app's sandbox/advisory policy.

## Overall Recommendation

Recommended SHIP status: **SHIP可, conditional**.

Conditions:

1. Fable must confirm ownership of the `review.*` and `docs/engine-spec.md` changes shown in the worktree. If any reviewer-owned file was edited by the implementation agent, block SHIP.
2. Fable should clean the stale `review.sba-defeat` header comment before final commit, because it contradicts the now-correct 903.10a advisory assertion.

No CR-grounding, fixed-point, label-aggregation, snapshot, or advisory-enforcement blocker was found in the implementation itself. Final judgment remains Fable's.
