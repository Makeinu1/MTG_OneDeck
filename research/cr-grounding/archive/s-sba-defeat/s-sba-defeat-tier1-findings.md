# S-SBA defeat-state — Tier-1 adversarial audit findings

**Auditor**: cold Tier-1 reviewer, no prior session context. Findings only — no files modified, no fixes applied.

## Top-line verdict: PASS (ready for Fable Tier-2), with 2 non-blocking follow-ups noted

All four machine checks pass clean. The reviewer-owned acceptance test exists, was not weakened,
and its 10 adversarial pins all pass. No prohibited-file tampering found. CR grounding for
704.5a/b/c, 104.3b/c/d, 121.4/121.5, 122.1f checked against `rule/Magic_The_Gathering_Comprehensive_Rules.txt`
verbatim and matches the implementation and golden cases. No scope creep into commander damage
(903.10a), layers, replacement effects, or 2HG poison/life thresholds found — these are explicitly
tested as *absent* (deferred) rather than merely undocumented.

Two moderate, non-blocking gaps are flagged below (property-test coverage gap; an untested
interleaving with `pendingRuleChoices`). Neither breaks an existing invariant or the sandbox
contract; both are candidates for a fast-follow, not blockers to Tier-2 sign-off.

---

## Ranked findings (most severe first)

### FINDING 1 (MEDIUM — coverage gap, not a correctness bug)
`src/engine/__tests__/review.properties.test.ts` (the reviewer-owned I1–I7 fast-check property
suite) was **not modified** by this change (`git diff --stat` shows no diff; `git status` shows it
untouched). CLAUDE.md's design principle states: "GameState に状態を追加したら対応する不変条件も追加する"
(when adding state to GameState, add the corresponding invariant too). New fields
`defeat: Partial<Record<DefeatPlayerRef, DefeatAdvisoryRecord>>` and
`emptyLibraryDrawAttemptedSinceLastSba: Partial<Record<PlayerId, boolean>>` were added to
`GameState` with no dedicated property-based invariant (e.g., "reasons only ever contains the 3
known enum values," "SBA fixed-point always terminates under arbitrary life/poison/draw walks,"
"simultaneousGroupId only ever groups reasons from the same pass").

Mitigating factor: the existing random-walk command generator in `review.properties.test.ts`
already emits `adjustLife`, `adjustPlayerCounter` (poison), `draw`, `adjustOpponentLife`, and
`mill` (confirmed at lines 86–227), so the new SBA defeat logic *is* exercised under I4's
no-mutation fuzzing check incidentally — but there is no dedicated fast-check property asserting
defeat-specific invariants, only the hand-written example-based golden/review tests. This is a
real hole relative to project convention, not a proven bug.

Recommendation: not a blocker for Tier-2, but should be logged as a fast-follow before this
substrate is treated as "frozen" alongside the other CR704.5 SBA slices.

### FINDING 2 (LOW — untested interleaving, plausibly correct but unverified)
`performStateBasedActionsOnce` (src/engine/commands.ts:1078-1081) returns `false` immediately,
**before** calling `applyDefeatStateBasedActions`, whenever `draft.state.pendingRuleChoices.length > 0`
(e.g., a pending legend-rule choice). This means: if life hits 0 (or poison hits 10) in the same
moment a legend-rule choice is queued, the defeat advisory is not recorded until the pending
choice resolves and the SBA loop runs again. This is plausibly the *correct* CR-consistent
behavior (CR 704.3's "SBA are performed as a single event" framing generally happens once other
pending choices are cleared), but there is no golden case or reviewer test exercising this
specific interleaving (legend rule + life-zero in the same state transition). Flagging as an
untested edge, not a known defect.

### FINDING 3 (INFORMATIONAL — scope note, not a defect)
Empty-library-draw defeat (704.5b) and poison defeat (704.5c) are implemented for player `P1`
only; `markEmptyLibraryDrawAttempt` is only ever called with the literal `'P1'` (confirmed: only
call site is `drawCards`, hardcoded). Opponent poison and opponent empty-library-draw are out of
scope. This is **consistent with and explicitly documented** in
`research/cr-grounding/s-sba-defeat.draft.md` (lines 9, 62-63: "no `opponentPoison` field exists,"
"opponent poison defeat is deferred") and in `docs/engine-spec.md` §34.15 item 1 and item 7 (scope
boundary). Not a hidden gap — a deliberate, disclosed scope choice matching the existing
single-numeric-poison-field architecture. No action needed.

---

## Per-check results

### 1. Machine checks 4-point — ALL PASS

**`npm run lint`**
```
> mtg-onedeck@0.0.0 lint
> eslint .
```
(clean exit, no output = no violations)

**`npx tsc --noEmit`**
```
(no output = clean compile)
```

**`npx vitest run`**
```
 Test Files  101 passed (101)
      Tests  1091 passed (1091)
   Start at  23:32:41
   Duration  15.09s
```

**`npm run build`**
```
> mtg-onedeck@0.0.0 build
> tsc -b && vite build

vite v8.0.16 building client environment for production...
✓ 77 modules transformed.
dist/index.html                   1.26 kB │ gzip:   0.55 kB
dist/assets/index-Cd1X7s80.css   73.12 kB │ gzip:  12.61 kB
dist/assets/index-FkTSca94.js   478.53 kB │ gzip: 142.69 kB
✓ built in 132ms
```

### 2. Reviewer test — EXISTS, PASSES, 10/10 adversarial pins green

`src/store/__tests__/review.sba-defeat.test.ts` exists (untracked = newly added, correctly not
modifying any pre-existing reviewer file). Isolated run:

```
 ✓ 704.5a: app player life reaching 0 sets a lifeZero advisory
 ✓ 704.5a: an opponent life label at 0 sets its own lifeZero advisory
 ✓ 704.5c: poison 10 sets a poison advisory but poison 9 does not
 ✓ 704.5b: drawing from an empty library sets emptyLibraryDraw and clears the interval flag
 ✓ 704.5b/121.5: milling from an empty library does NOT set emptyLibraryDraw
 ✓ 704.3: re-checking SBA while life<=0 terminates and does not duplicate advisory events
 ✓ sandbox: a defeat advisory does not null state, block phases, or end the game
 ✓ 704.3: life<=0 and poison>=10 in one SBA pass share a simultaneousGroupId
 ✓ forward-compat: a snapshot without defeat fields restores and backfills to empty
 ✓ 903.10a deferred: commander damage 21 does not create a defeat advisory here

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

The 10 pins are genuinely adversarial: exact life=0 boundary, opponent-label independence,
poison 9-vs-10 boundary, empty-draw interval-flag clearing (CR 121.4), mill≠draw (CR 121.5),
fixed-point termination + non-duplication (CR 704.3), sandbox non-enforcement (vs CR 104.5),
same-pass simultaneity grouping, snapshot forward-compat, and an explicit commander-damage
scope-boundary negative test. This is not a rubber-stamp test file.

### 3. Test-weakening / prohibited scan — CLEAN

- `git diff -- src/store/__tests__/crGroundingGoldenCases.test.ts`: purely additive (11 new `it()`
  blocks + 2 helper functions `defeatReasonsFor`/`defeatEvents`). No removed `expect`s, no
  `.skip`/`.todo`/`.only`, no loosened matchers, no commented-out cases.
- `git diff -- src/engine/__tests__/priority.test.ts`: a 2-line addition to a test fixture object
  (`defeat: {}`, `emptyLibraryDrawAttemptedSinceLastSba: {}`) to keep an existing state-shape
  literal in sync with the new required `GameState` fields. Benign, required for `tsc` to pass
  given the new non-optional fields.
- `grep -n ".skip|.todo|.only|xit(|xdescribe(" src/store/__tests__/crGroundingGoldenCases.test.ts
  src/engine/__tests__/priority.test.ts src/store/__tests__/review.sba-defeat.test.ts` → no
  matches in any of the three files.
- `git diff --name-only | grep 'review\.'` → no output (no pre-existing reviewer-owned file was
  modified). `git status --porcelain` shows exactly one `review.*` file, and it is untracked
  (newly added): `src/store/__tests__/review.sba-defeat.test.ts`.
- `CLAUDE.md`: not in the changed-file list at all (confirmed via `git diff --name-only`).
- `docs/`: only `docs/engine-spec.md` changed. Its diff (40 lines) is scoped entirely to a new
  §34.15 section documenting the S-SBA defeat-state contract (type contract, event metadata, draw
  hook, SBA algorithm, sandbox policy, golden/test references, and scope boundary). No unrelated
  doc changes were bundled in.

### 4. CR-grounding sanity — MATCHES CR TEXT

Verified against `rule/Magic_The_Gathering_Comprehensive_Rules.txt`:
- CR 704.5a (line 5492): "If a player has 0 or less life, that player loses the game." — matches
  `state.life <= 0` check.
- CR 704.5b (line 5494): "If a player attempted to draw a card from a library with no cards in it
  since the last time state-based actions were checked, that player loses the game." — matches
  the `emptyLibraryDrawAttemptedSinceLastSba` flag design and its per-SBA-check clearing.
  CR 121.4 (line 1158) confirms the "attempted to draw" framing (not merely "library is empty"),
  which the implementation honors: `drawCards` checks library emptiness on *each* individual draw
  iteration (verified at commands.ts:1373-1378), correctly catching the "drew 1 of 2 requested,
  library ran out on the 2nd" case per CR 121.2/121.4 — this is asserted by the
  `cr-sba-defeat-empty-library-draw-partial-multidraw` golden case.
- CR 704.5c (line 5496): "If a player has ten or more poison counters... Ignore this rule in
  Two-Headed Giant games" — matches `state.poison >= 10` and the explicit 2HG/opponent-poison
  deferral documented in the draft and spec.
- CR 121.5 (line 1160): mill is not a draw — matches `applyMill` never calling
  `markEmptyLibraryDrawAttempt`, confirmed by grep (only call site of that function is inside
  `drawCards`).
- All golden cases' `mustNot` fields consistently assert: "敗北advisoryのためにzoneChange eventを捏造しない"
  (don't fabricate zoneChange events for a defeat advisory), "game終了やstate null化を行わない" (no
  game-end or state-nulling), and equivalents. No golden case treats defeat as
  hard-enforcing — all require continued state/playability. This matches the sandbox contract.
- `applyDefeatStateBasedActions`'s idempotency logic was traced line-by-line: it returns `added`
  (true only when a genuinely new reason is recorded), and clearing the
  `emptyLibraryDrawAttemptedSinceLastSba` flag alone does NOT set `added = true` — this precisely
  matches the spec's item 4(c) "flag クリアは bookkeeping であり...戻り値を true にしない" requirement,
  and is why the CR 704.3 fixed-point/no-duplicate-event tests terminate and pass.

No enforcing (game-ending / state-nulling) treatment of defeat was found anywhere in the diff.

### 5. Scope creep — NONE FOUND

- Commander damage (903.10a): explicitly tested as *absent* in this slice
  (`cr-sba-defeat-commander-damage-deferred` golden case and the review test's pin #10). The
  `adjustCommanderDamage` command still updates `state.commanderDamage`, but no defeat reason or
  `defeatAdvisory` event is created for it — confirmed by both the golden case and passing test.
- Layers, replacement effects, player-specific zones: no references found in any of the diffed
  files; `docs/engine-spec.md` §34.15 item 7 explicitly lists these (plus CR104.4a multi-player
  simultaneous-loss draw ordering, 2HG team thresholds CR704.6a/b, opponent poison) as carried
  forward to later slices.
- `docs/engine-spec.md` diff is scoped to exactly one new section (§34.15); no edits to unrelated
  sections found in the diff.

---

## Summary for the record

- Machine checks: 4/4 pass (lint, tsc, vitest 1091/1091, build).
- Reviewer test: exists, 10/10 pass, genuinely adversarial (not tautological).
- No test weakening, no prohibited-file edits, no CLAUDE.md/docs scope creep.
- CR grounding checked against primary source text and matches on all three sub-rules
  (704.5a/b/c) plus supporting rules (104.3b/c/d, 121.4/121.5, 122.1f).
- Sandbox/advisory-only contract verified in both code and tests — no hard-enforcement found.
- Scope boundary (commander damage, 2HG, layers, replacement) correctly deferred and tested as
  absent, not merely undocumented.
- Two follow-up items logged (property-test coverage gap; untested pendingRuleChoices
  interleaving) — neither blocks Tier-2 sign-off, both worth a fast-follow ticket.
