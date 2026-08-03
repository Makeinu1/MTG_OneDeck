# §34.52 CR719 Case Cards — Design Contract (Judge Draft)

> Status: **drafted** (judge-owned). 実装者は本契約の範囲内でのみ実装する。
> CR refs: 719.3, 702.169 (pinned CR 2026-06-19).
> dependsOn: cr-603-triggers-apnap (shipped), cr-604-611-612-613-layers-continuous (shipped).

## 1. CR grounding

| CR | Clause | Implementation |
|----|--------|----------------|
| 719.2 | Case frame has no additional rules meaning. | Type-line detection only (`Enchantment — Case`). |
| 719.3a | "To solve — [Condition]" = "At the beginning of your end step, if [condition] and this Case is not solved, this Case becomes solved." | `caseGrammar.ts` parses the To-solve condition; automatic end-step evaluation of arbitrary conditions is deferred (guided/manual). Engine substrate provides the designation transition command. |
| 719.3b | Solved is a designation; persists until leaving the battlefield; not an ability, not copiable. | `CardInstance.solved?: boolean`. Reset by `resetCardForZoneChange` (CR 400.7). Not in `ObjectSnapshot`. |
| 719.3c / 702.169b | "Solved — [static ability]" = "As long as this Case is solved, [ability]." | Static half: Layer 6 — solved-prefixed lines grant keywords only when `solved === true`. |
| 702.169c | "Solved — [triggered]" triggers only if solved. | Deferred (trigger gating slice). |
| 702.169d | "Solved — [activated]" activate only if solved. | Deferred (store activation gate slice). |

## 2. State substrate

### 2.1 `CardInstance.solved?: boolean`

- Optional field (types.ts). `undefined`/`false` = not solved.
- Type-agnostic field (only Case cards set it).
- NOT an ability, NOT copiable (719.3b): excluded from `ObjectSnapshot`.
- `resetCardForZoneChange` resets `solved: undefined` (new object per CR 400.7; a Case leaving and re-entering is unsolved).
- Same-zone reorder must NOT reset (same chokepoint as classLevel).

### 2.2 `GameCommand.setSolved`

```ts
| { type: 'setSolved'; cardId: string; solved: boolean }
```

- Idempotent: if `card.solved === cmd.solved` (treating undefined as false), no state change, no log.
- Log (only on change): solved=true → `${name}は解決された。`; solved=false → `${name}の解決状態を取り消した。`
- Validation: `cmd.solved` must be boolean (TypeScript type); no runtime throw needed beyond existing `requireCard`.
- Note: CR 719.3b says solved persists; `setSolved(false)` is a sandbox/setup correction escape hatch, documented as such.

## 3. Grammar: `caseGrammar.ts`

New module `src/engine/caseGrammar.ts` (parallel to sagaGrammar/classGrammar).

```ts
export interface CaseSections {
  /** Condition text after "To solve —" (719.3a); undefined if absent. */
  toSolveCondition?: string;
  /** Ability lines prefixed by "Solved —" (702.169), prefix stripped. */
  solvedAbilities: string[];
}

export function parseCaseSections(oracleText: string | undefined | null): CaseSections;
```

- Line starting with `To solve —` (em/en/hyphen variants) → capture condition.
- Lines starting with `Solved —` → push stripped text to `solvedAbilities` in order.
- All other lines ignored. Empty/null → `{ solvedAbilities: [] }`.
- Export `isSolvedGatedLine(line): boolean` helper used by status.ts.

## 4. Layer 6 static gate (702.169b)

In `status.ts` static ability collection for battlefield cards:

- Lines matching `Solved —` are EXCLUDED from the normal static line pool when the card is NOT solved.
- When the card IS solved, strip the `Solved —` prefix and feed the remainder to the existing additive keyword parser (`parseLayer6AdditiveKeywordLine` discipline).
- Only battlefield Cards with `solved === true` get the gated lines; off-battlefield never grants.
- Non-keyword static text inside solved lines is honestly ignored (deferred), same discipline as Class bars.

## 5. Out of scope (deferred, recorded)

- Automatic end-step condition evaluation (719.3a trigger with arbitrary condition) → guided/manual.
- Triggered Solved abilities gating (702.169c) → deferred.
- Activated Solved abilities gating (702.169d) + store integration → deferred.
- UI rendering of Case frame → deferred.

## 6. Golden cases (judge-owned review test)

| ID | Scenario | CR | Expected |
|----|----------|-----|----------|
| C1 | Case enters battlefield | 719.3b | `solved` falsy, no solved-gated keywords |
| C2 | `setSolved(true)` | 719.3b | solved true; static keywords from "Solved —" line granted |
| C3 | `setSolved` idempotent | — | no duplicate log |
| C4 | Case leaves battlefield and returns | 400.7/719.3b | solved reset, gated keywords gone |
| C5 | Same-zone reorder preserves solved | 400.7 | solved retained |
| C6 | `parseCaseSections` on real oracle (e.g. Case of the Locked Door style) | 719.3 | condition + solved lines parsed |
| C7 | Non-Case permanent: solved designation settable but no Case-specific behavior | 719.3b | designation persists; Layer 6 gate applies only via solved lines in its own text |
| C8 | Top-section (non-solved) static line unaffected by solved state | 719.3c | always active |

## 7. Invariants

- I55: `solved` is boolean or undefined for every card.
- I56: off-battlefield cards never contribute solved-gated keywords.

## 8. Deliverable files

| File | Change |
|------|--------|
| `src/engine/types.ts` | `CardInstance.solved?: boolean` |
| `src/engine/caseGrammar.ts` | NEW parser |
| `src/engine/commands.ts` | `setSolved` command; `resetCardForZoneChange` solved reset |
| `src/engine/status.ts` | solved-gated Layer 6 static collection |
| `src/engine/__tests__/caseGrammar.test.ts` | implementer tests |
| `src/engine/__tests__/review.cr719-case-cards.test.ts` | judge-owned review test |
