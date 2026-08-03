# Implementer Brief: CR716 Class Cards (§34.51)

## Milestone

- ID: `cr-716-class-cards`
- Base SHA: `5763a7e1c8af919facbe2b0120d0bcb0a351fa52`
- Contract: `research/cr-grounding/cr716-class-cards.draft.md`
- Review test (DO NOT MODIFY): `src/engine/__tests__/review.cr716-class-cards.test.ts`

## Goal

Implement Class card level designation, level-gated keyword grants via Layer 6, and activation legality per CR 716.2–716.4.

## Constraints

1. Do NOT modify `review.cr716-class-cards.test.ts` or any `review.*` file.
2. Do NOT modify `AGENTS.md`, `CLAUDE.md`, `eslint.config.js`, `docs/`, ledger files.
3. Do NOT use git commands.
4. Do NOT change `SNAPSHOT_VERSION` or `CACHE_SCHEMA_VERSION`.
5. TypeScript strict, no `any`. UI text in Japanese, code/comments/identifiers in English.
6. `src/engine/` is pure functions only — no React/DOM/Zustand imports.
7. Existing tests must remain green.

## Deliverables

### 1. `src/engine/classGrammar.ts` (NEW)

Parallel to `sagaGrammar.ts`. Export:

```ts
export interface ClassLevelBar {
  level: number;
  costText: string;
  abilitiesText: string;
}

export function parseClassLevelBars(oracleText: string | undefined | null): ClassLevelBar[];
export function classLevelBarKeywords(bars: ClassLevelBar[], level: number): string[];
export function classLevelActivationLegal(state: GameState, cardId: string, barLevel: number): boolean;
```

- `parseClassLevelBars`: regex `/^(.+):\s*Level\s+(\d+)\s*[—–-]\s*(.+)$/i` per line. Returns bars in order. Empty/null → `[]`.
- `classLevelBarKeywords`: for bars where `bar.level <= level`, extract keyword identifiers from `abilitiesText` using the same keyword vocabulary as `status.ts` (`isKeyword` guard from the keyword list). Return deduplicated strings.
- `classLevelActivationLegal`: returns `classLevelOf(state, cardId) === barLevel - 1`. Import `classLevelOf` from `status.ts`.

### 2. `src/engine/types.ts`

Add to `CardInstance`:
```ts
classLevel?: number; // CR 716.2b: class level designation (not a counter)
```

### 3. `src/engine/commands.ts`

Add to `GameCommand` union:
```ts
| { type: 'setClassLevel'; cardId: string; level: number }
```

Add case in `applyCommandInternal`:
- If `card.classLevel === cmd.level`, break (idempotent, no log).
- Otherwise set `classLevel` and push log: `${nameOf(draft, cmd.cardId)}のクラスレベルを${cmd.level}にしました。`

### 4. `src/engine/status.ts`

Export:
```ts
export function classLevelOf(state: GameState, cardId: string): number {
  return state.cards[cardId]?.classLevel ?? 1; // CR 716.2d
}
```

Extend `effectiveKeywords`: after the existing `forEachAdditiveStaticSourceLine` loop, add:
- If `currentTypeLine(def, card)` includes `'Class'` and card is on battlefield:
  - Parse `parseClassLevelBars(oracleText)` from the def's current face.
  - For each bar where `bar.level <= classLevelOf(state, cardId)`, extract keywords via `classLevelBarKeywords([bar], bar.level)` (or equivalent).
  - Append to `granted`.

### 5. Implementer tests

- `src/engine/__tests__/classGrammar.test.ts`: unit tests for parser edge cases.
- `src/store/__tests__/classActivation.test.ts`: store-level activation gate test (if store integration is done).

### 6. Store integration (minimal)

In `gameStore.ts` `activateAbility`: if the ability line matches a class level bar pattern and `classLevelActivationLegal` returns false, push a warning and return. On successful resolution, issue `setClassLevel`.

**If store integration is complex, defer it** — the engine-level substrate (command, accessor, Layer 6, activation legality function) is the priority. The review test only tests engine-level behavior.

## Done when

1. `npx vitest run src/engine/__tests__/review.cr716-class-cards.test.ts` — all green.
2. `npx vitest run src/engine/__tests__/classGrammar.test.ts` — all green.
3. No existing `review.*` tests broken.
4. Report: changed files, acceptance results, deferrals, open issues.
