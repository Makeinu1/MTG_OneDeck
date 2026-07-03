# Tier-1 Cold Audit: cr-602 slice 2 (nonmana activation cost components)

**Audit target**: uncommitted working-tree diff on top of commit `c1b47f9` (S-ACTIVATED-ABILITY slice 1).
Implements pay-life / discard / non-self-sacrifice cost components under engine-spec §34.19.
**Auditor**: independent cold Tier-1 auditor (no involvement in implementation). Findings only — no
contract files modified, no git write operations performed.

## Scope note

`git status` also shows untracked `research/mydeck-scoring/` and `scripts/mydeck-scoring/`. These are
unrelated to this diff (different milestone artifacts) and are excluded from this audit.

`research/cr-grounding/s-activated-ability-envelope.draft.md` and
`s-activated-ability-golden.draft.md` are already git-tracked (committed as part of slice 1's
design-lock), not part of the current uncommitted diff — not a forbidden-file concern here.

---

## 1. MANDATORY MACHINE CHECKS — raw results

### 1. `npm run lint`
```
> mtg-onedeck@0.0.0 lint
> eslint .
```
**PASS** — no output, exit clean, zero lint errors/warnings.

### 2. `npx tsc --noEmit`
```
(no output)
```
**PASS** — zero type errors.

### 3. `npx vitest run`
```
 Test Files  106 passed (106)
      Tests  1141 passed (1141)
   Start at  21:58:21
   Duration  16.16s
```
**PASS** — full suite green, 1141/1141 tests.

### 4. `npm run build`
```
> mtg-onedeck@0.0.0 build
> tsc -b && vite build

vite v8.0.16 building client environment for production...
✓ 77 modules transformed.
dist/index.html                   1.26 kB │ gzip:   0.55 kB
dist/assets/index-Cd1X7s80.css   73.12 kB │ gzip:  12.61 kB
dist/assets/index-CrH9iTFR.js   495.95 kB │ gzip: 147.10 kB
✓ built in 132ms
```
**PASS** — production build succeeds.

### Reviewer-owned acceptance files (explicit pin count)

Ran targeted:
```
npx vitest run src/store/__tests__/review.activated-envelope.test.ts \
  src/engine/__tests__/review.g4-activate.test.ts \
  src/store/__tests__/review.mana-transaction.test.ts
```
Result: **3 files passed, 27 tests passed** (note: `review.g4-activate.test.ts` lives under
`src/engine/__tests__/`, not `src/store/__tests__/` — path corrected during the audit).

- `review.activated-envelope.test.ts`: **PASS**, 11/11 pins (6 slice-1 pins in the top-level
  `describe`, 5 slice-2 pins in the `§34.19 slice 2` describe block, confirmed by direct read).
- `review.g4-activate.test.ts`: **PASS** (part of the 27; existing §33 G4 cost path unbroken).
- `review.mana-transaction.test.ts`: **PASS** (part of the 27; §34.11 mana transaction path
  unbroken).

**Overall machine-check verdict: 4/4 PASS, all reviewer-owned acceptance green.**

---

## 2. ADVERSARIAL CHECKLIST

### 1. FORBIDDEN FILES — GREEN (with note)

`git diff --name-only`:
```
src/components/playmat/Playmat.tsx
src/engine/commands.ts
src/engine/grammar/compile.ts
src/engine/types.ts
src/store/__tests__/activatedAbilityEnvelope.test.ts
src/store/__tests__/review.activated-envelope.test.ts
src/store/gameStore.ts
```
`review.activated-envelope.test.ts` appears in the diff, but `git diff --numstat` shows it is
**purely additive (+115/-0)** — the entire slice-2 `describe` block (5 new pins) is new content,
consistent with the judge extending its own acceptance contract per the audit brief ("the last
describe block is slice 2" / judge-authored). No `docs/`, no `cr-backbone-ledger.json`, no
`golden-cases.json`, no `*.draft.md` touched by this diff. **Not attributed to the implementer.**

### 2. NO FAKE AUTO (§34.19) — GREEN

`src/engine/types.ts`: `ActivationCostComponentKind` includes `pay-life` / `discard` /
`sacrifice-object` alongside existing `mana`/`tap-self`/`sacrifice-self`.
`ActivationCostComponentStatus = 'auto' | 'guided' | 'manual' | 'unparsed'` matches spec exactly.

`src/engine/commands.ts`:
- `parsePayLifeCostElement` (line ~2059): `status: 'guided'` hardcoded.
- `parseDiscardCostElement` (line ~2095, ~2124): `status: 'guided'` hardcoded in both the
  "discard your hand" and "discard N cards" branches.
- `parseSacrificeObjectCostElement` (line ~2169): `status: 'guided'` hardcoded.
- `grep -n "status:" src/engine/commands.ts` returns exactly 5 hits: 4 literal `'guided'`
  assignments (the 4 above) + the `ActivationCostComponent['status']` type annotation on the
  pre-existing `activationCostComponents(...)` parameter (§33 auto path, unchanged).
- `activationCostComponents` (line 2233, pre-existing/slice-1) is the ONLY place `status: 'auto'`
  can originate, and it only ever emits `kind: 'mana' | 'tap-self' | 'sacrifice-self'`
  (verified by reading the full function body — three `if` blocks, no others).

Nonmana cost elements are stripped out of the raw cost string BEFORE the residual is handed to
the existing `compileAbilityCost` (§33) auto path (`activationPlanForSource`, line ~2495:
`nonmanaCost = activationNonmanaCosts(...)`, then `autoCost = abilityCostFromRaw(nonmanaCost.remainingRaw)`).
This confirms §33 is wrapped, not replaced, and never sees pay-life/discard/sacrifice-object text.

**No fake-auto violation found.**

### 3. ATOMICITY ALL-OR-NOTHING (118.3/601.2h) — GREEN

`commitActivation` (`src/store/gameStore.ts:1245`):
```ts
const forced = pending.paymentMode === 'forced';
if (!forced && warnings.length > 0) {
  set({ warnings: [...get().warnings, ...warnings], pendingGuided: null });
  return;   // <-- returns BEFORE any applyCommands call
}
...
const result = applyCommands(cur, [...pending.commands, addCmd]);
```
`warnings` aggregates `activationCostWarnings` (pay-life shortfall, discard-hand shortfall,
sacrifice-candidate shortfall — all three added in this diff) + `missingTargetWarnings` +
`uncheckedTargetWarnings` + `costSubjectWarnings` (new). Any one insufficiency blocks the entire
`commitActivation` call in rules-legal mode — no partial `applyCommands` is ever invoked.

`applyCommands` (`src/engine/batch.ts`) folds over commands against an immutable `state`,
building a new `next` binding; it never mutates `state`/`cur` in place. `commitActivation` wraps
the call in try/catch — on `EngineError` throw, the constructed `next` is discarded and `commit()`
is never called, so `get().state` remains the pre-activation snapshot. This is genuine
copy-on-write atomicity, not a rollback simulation.

Multi-component test coverage (implementer's own `activatedAbilityEnvelope.test.ts`, not the
review file, but directly inspected): `'keeps multiple nonmana costs atomic when one modeled
component cannot be paid'` — cost `"Pay 5 life, Discard a card: Draw a card."` with life=2:
asserts `stateSnapshot()` unchanged, `pendingGuided` is `null`, stack length 0, discard card still
in hand, life unchanged at 2. This directly covers the checklist's "tap + pay life" style combo
concern (here pay-life + discard) and **passes**.

Reviewer pin `'118.3b: "Pay N life" with insufficient life commits no stack object and no life
change'` (review file, line 230) independently pins the single-component case and **passes**.

**No partial-payment violation found.**

### 4. FORCED BOUNDARY + SUBJECT REQUIRED — GREEN

`forcedActivationWarning` produces a warning string containing `"CR-legalとして扱いません"`
(`"CR-legal"` substring present, matching the reviewer's `w.includes('CR-legal')` check). Reviewer
pin `'forced: "Pay N life" past insufficient life commits with a non-CR-legal warning'`
(review file line 248) confirms stack length 1 + CR-legal warning present on force. **PASS.**

Critical F-4-analog check: `confirmGuidedCostSubject` (gameStore.ts:2341) is only reached via the
prompt queue — `activationPrompts = [...targetPrompts, ...pendingActivation.costPrompts]`
(gameStore.ts, activateAbility flow) is populated regardless of `forced`; `forced` only affects
whether unpayable-cost *warnings* block commit, not whether cost-subject *prompts* are queued.
Reviewer pin `'118.3: forced mode still requires the discard subject (no empty-subject commit)'`
(review file line 312) force-activates a discard-cost ability with a non-empty hand and asserts
`zones.stack` length 0 and `pendingGuided.prompts[0].kind === 'cost-discard'` — i.e., forced mode
does NOT skip to an empty-subject commit. **PASS**, confirmed both by direct code read and by the
passing pin.

Edge case noted (not a bug, a UX note): if forced-activating a discard/sacrifice-cost ability with
**zero** eligible subjects (e.g., truly empty hand), `TargetPickerDialog` renders "対象がありません"
with only a Cancel button — the activation stays stuck pending a selection that can never be made,
rather than force-committing an empty-subject cost component. This is CR-safer (never fakes an
empty-subject payment) but means the sandbox "force" escape hatch cannot fully bypass a
zero-candidate discard/sacrifice cost. No test currently exercises the zero-candidate forced case
specifically (the existing F-4-analog pin uses a non-empty hand). Recommend as a documented gap
rather than a blocking defect — behavior is safe-by-omission, not silently wrong.

### 5. SELF vs NON-SELF SACRIFICE — GREEN

`parseSacrificeObjectCostElement` (commands.ts) calls `isSelfSacrificeSubject(subject, sourceName)`
and returns `null` (i.e., does not treat as a non-self/guided component) when the subject is
self-referential (`it`/`self`/`~`/`this...`/matches the source's own face name). Non-self subjects
("a creature", "another Elf", "two Goblins") produce a `sacrifice-object` component with a
`cost-sacrifice` prompt.

Defense in depth at commit time: `confirmGuidedCostSubject` explicitly rejects
`cardId === pending.activation.sourceId` for `cost-sacrifice` prompts (gameStore.ts, unconditional
check, not gated by `forced`) — the source can never be chosen as its own non-self-sacrifice
subject even if a caller bypassed the picker UI.

Cross-check against the pre-existing §33 self-sacrifice path (`compile.ts`
`NON_SELF_SACRIFICE_PREFIXES` = {a, an, another, all, each, two..ten}): both layers agree that
"Sacrifice a/an/another/N X" is non-self, and only "Sacrifice CARDNAME/this/it/~" is self. Since
slice 2's parser runs first and strips out everything it identifies as non-self, the residual
reaching `compileAbilityCost`'s self-sacrifice check only ever contains genuinely self-referential
text — no double-counting or gap between the two layers.

Reviewer pin `'601.2f: "Sacrifice a creature" sacrifices the guided-chosen creature, not the
source'` (review file line 288) asserts victim moves to graveyard AND source remains on
battlefield. **PASS.**

### 6. PAY-LIFE CORRECTNESS (118.3b) — GREEN

`parsePayLifeCostElement` regex: `/^Pay\s+(a|an|one|two|...|ten|\d+)\s+life$/i` — matches "Pay 3
life", "Pay a life", "Pay five life", etc. `parseCostAmountToken` maps word-numbers 1-10 and
digit strings to integers. Component emits `commands: [{ type: 'adjustLife', delta: -amount }]`.
The `adjustLife` command handler (commands.ts:3258) delegates to the pre-existing
`applyPlayerLifeDelta` (shared with §34.18 life-event envelope) — reuses proven life-subtraction
logic rather than a new hand-rolled path.

Reviewer pin `'118.3b: "Pay N life" with insufficient life commits no stack object and no life
change'` and implementer pin `'blocks unpayable pay-life costs...forced mode commits with warning'`
(asserts `state.life === -1` after forced-paying 3 life from a life=2 start, i.e., life correctly
goes negative — matches CR 118.3b, no floor-clamping bug) both **PASS**.

### 7. EXISTING PATHS UNBROKEN — GREEN

Full `vitest run`: 106/106 files, 1141/1141 tests passed, including
`review.g4-activate.test.ts` and `review.mana-transaction.test.ts` (both explicitly re-run and
confirmed passing above). Diff inspection of `compileAbilityCost` and `activationCostComponents`
shows no behavioral change to the §33 auto path itself — only its caller
(`activationPlanForSource`) now pre-filters nonmana elements out of the raw cost string before
invoking it, and appends `costPrompts`/extra components to its own return value. The §33 function
bodies are untouched in this diff (confirmed via `git diff src/engine/grammar/compile.ts`, which
shows only the 3-line `PromptKind` union extension and a 3-line early-return in
`buildGuidedCommands` for the two new prompt kinds — no change to `compileAbilityCost` itself).

### 8. UI WIRING (code-read only) — GREEN

`Playmat.tsx` diff adds `guidedCostSelectedIds` (built via safe optional-chaining:
`component.subjectRef ? [...] : []`, `component.subjectRefs?.map(...) ?? []` — no unguarded
`.foo.bar` chains) and `guidedCostSubjectIds` (falls back to `[]` for any prompt kind other than
`cost-discard`/`cost-sacrifice`). Routes to a new `<TargetPickerDialog>` block wired to
`store.confirmGuidedCostSubject` / `store.cancelGuidedPrompt`.

`TargetPickerDialog` (pre-existing, reused component, read in full) explicitly handles the
empty-list case: `hasTargets = cardIds.length > 0 || playerIds.length > 0`; renders a "対象があり
ません" message with only a Cancel button when false — no render-throw hazard on empty lists, no
null deref. `cancelGuidedPrompt` only resets `pendingGuided: null` and never touches `state`, so
mid-flow cancellation of a cost prompt is safe (no orphaned partial cost commands — they were only
ever staged inside the local `PendingActivation.commands` array, never applied to store state
until final `commitActivation`).

No hazards found in the UI wiring.

---

## 3. Summary table

| # | Check | Verdict |
|---|---|---|
| 1 | Forbidden files | GREEN (review.* diff is judge-authored additive content, not implementer) |
| 2 | No fake auto | GREEN |
| 3 | Atomicity all-or-nothing | GREEN |
| 4 | Forced boundary + subject required | GREEN (minor UX gap noted, not a defect) |
| 5 | Self vs non-self sacrifice | GREEN |
| 6 | Pay-life correctness | GREEN |
| 7 | Existing paths unbroken | GREEN |
| 8 | UI wiring | GREEN |

**No RED FLAGS found.**

## 4. SHIP recommendation (advisory only — final judgment belongs to the judge)

All four mandatory machine checks pass. All 11 `review.activated-envelope.test.ts` pins pass
(6 slice-1 + 5 slice-2), plus `review.g4-activate.test.ts` and `review.mana-transaction.test.ts`
remain green, plus the full 1141-test suite is green. No forbidden-file violations attributable to
the implementer. No fake-auto, atomicity, or self/non-self sacrifice violations found under
adversarial review of the source. The one noted item (forced mode cannot bypass a truly
zero-candidate discard/sacrifice cost) is a safe-by-omission gap, not a correctness defect, and is
not covered by an existing pin — worth a follow-up pin if the judge wants full closure on the
forced-boundary contract, but does not block shipping this slice.

**Advisory: SHIP.**
