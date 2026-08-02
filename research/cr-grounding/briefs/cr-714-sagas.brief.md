# cr-714-sagas — Saga chapter abilities & SBA sacrifice

## Milestone

- ID: `cr-714-sagas-deferred-by-demand`
- Base SHA: `d233f76`
- CR refs: 714.2b, 714.2c, 714.2d, 714.3a, 714.3c, 714.4
- Lane: late-backbone
- Judge: deterministic-cr

## Goal

Implement Saga chapter ability triggers and the final-chapter sacrifice SBA so that
Saga permanents behave per CR 714 in the solitaire engine. Chapter ability *effects*
remain guided/manual (same pattern as other triggered abilities whose resolution text
is not yet compiled).

## Existing substrate (do NOT re-implement)

- ETB lore counter: `commands.ts` line ~1116 sets `counters.lore = 1` when a Saga enters.
- Turn-based lore increment: `handleUntapEntry` (line ~3048) adds +1 lore to active
  player's Sagas. **Timing bug**: CR 714.3c says "As a player's precombat main phase
  begins", not untap. Fix: move the lore increment to a new `handleMain1Entry` called
  when `phase === 'main1'` in `enterPhase`.
- `appendPendingTrigger(draft, trigger)` — deduplicates by `pendingTriggerId`.
- `objectSnapshotOf(draft, card)` — builds `ObjectSnapshot`.
- `performStateBasedActionsOnce(draft)` — SBA loop; battle 704.5v already uses the
  "skip if pending trigger exists for sourceId" pattern.
- `typeLineOf(draft, card)` — resolves type line including face.
- `nameOf(draft, cardId)` / `nameOfCard(draft, card)` — display name.
- `pushLog(draft, msg)` — Japanese log entry.
- `PendingTrigger` interface in `types.ts` line ~564.
- `normalizeSnapshotState` in `gameStore.ts` — backfill new GameState fields.

## Deliverables

### 1. Chapter ability parser (`src/engine/sagaGrammar.ts`)

Export a pure function:

```ts
export interface ChapterAbility {
  /** 1-based chapter numbers this ability triggers at (714.2c: "II, III —" → [2,3]) */
  chapters: number[];
  /** Effect text after the em-dash */
  effectText: string;
}

export function parseSagaChapters(oracleText: string): ChapterAbility[];
```

Parsing rules:
- Each line matching `/^(I{1,3}|IV|VI{0,3}|IX|X)\s*(,\s*(I{1,3}|IV|VI{0,3}|IX|X))*\s*[—–-]\s*(.+)$/`
  is a chapter line. Use a Roman numeral decoder (I–X sufficient for real Sagas; max
  observed is VII).
- Lines that don't match are ignored (non-chapter text like "This Saga enters..." or
  creature Saga static abilities).
- Return abilities in oracle-text order.
- Empty/missing oracleText → `[]`.

Also export:

```ts
export function finalChapterNumber(abilities: ChapterAbility[]): number;
```

Returns the greatest chapter number across all abilities, or 0 if empty (714.2d).

### 2. Chapter trigger generation

In `commands.ts`, after lore counters are put on a Saga (both ETB path and turn-based
path), call a new helper:

```ts
function emitSagaChapterTriggers(draft: Draft, card: CardInstance, previousLore: number, newLore: number): void;
```

Logic (714.2b): for each `ChapterAbility` whose `chapters` array contains any N where
`previousLore < N && newLore >= N`, create one `PendingTrigger` per ability line:

- `triggerId`: `saga-chapter-${card.id}-${abilityIndex}`
- `pendingTriggerId`: `${eventId}:saga-chapter:${snapshot.objectId}:${abilityIndex}`
- `simultaneousGroupId`: `saga-chapter-${draft.nextEventSeq}`
- `label`: `《name》の第${roman}章` (use the first chapter number in the ability for
  display; e.g. "II, III" → "第II章")
- `stackPlacementBucket`: `'ability-triggered'`
- `resolutionText`: the ability's `effectText`
- `abilityLineIndex`: the index within `parseSagaChapters` result

Use `appendPendingTrigger` for dedup safety.

### 3. Lore counter timing fix (714.3c)

Move the Saga lore increment block out of `handleUntapEntry` into a new
`handlePrecombatMainEntry(draft)` called when `phase === 'main1'` in `enterPhase`.
The untap handler retains untap/counter-reset logic only.

After incrementing lore, call `emitSagaChapterTriggers` with previousLore and newLore.

For the ETB path (line ~1116): after setting `counters.lore = 1`, call
`emitSagaChapterTriggers(draft, updatedCard, 0, 1)`.

### 4. SBA 714.4 — final chapter sacrifice

In `performStateBasedActionsOnce`, after the existing battle checks, add:

```ts
// CR 714.4: a Saga whose lore counters >= final chapter number is sacrificed
// unless it has a chapter ability that has triggered but not yet left the stack.
const sagaSacrificeIds = Object.values(draft.state.cards).flatMap((card) => {
  if (card.zone !== 'battlefield') return [];
  if (!typeLineOf(draft, card).includes('Saga')) return [];
  const oracleText = /* resolve oracleText via face */;
  const abilities = parseSagaChapters(oracleText);
  const finalChapter = finalChapterNumber(abilities);
  if (finalChapter === 0) return []; // 714.2d: no chapter abilities
  const lore = card.counters.lore ?? 0;
  if (lore < finalChapter) return [];
  // Skip if a chapter ability from this Saga is pending (triggered but not resolved)
  const hasPendingChapter = draft.state.pendingTriggers.some(
    (t) => t.sourceId === card.id && t.triggerId.startsWith('saga-chapter-'),
  );
  return hasPendingChapter ? [] : [card.id];
});
```

Move each to graveyard with `sbaApplied: '714.4'` and a Japanese log:
`《name》は最終章に達したため生贄に捧げられた(状況起因処理714.4)。`

### 5. GameState field (if needed)

No new GameState field is required — `pendingTriggers` already tracks "triggered but
not yet left the stack" (same pattern as 704.5v). If you find a need for one, add it
and backfill in `normalizeSnapshotState`.

### 6. Tests (ordinary, NOT review.*)

Create `src/engine/__tests__/sagaGrammar.test.ts`:
- Parse a 3-chapter Saga (e.g. "I — Draw a card.\nII, III — Each opponent loses 2 life.\nIV — You gain 4 life.")
- Parse empty text → []
- Parse non-Saga text → []
- finalChapterNumber correctness
- Multi-chapter line (II, III) produces chapters [2, 3]

Create `src/engine/__tests__/sagaChapterTriggers.test.ts`:
- ETB Saga with lore=1 triggers chapter I
- Turn-based lore increment triggers correct chapter
- Multi-chapter line triggers once when crossing both thresholds simultaneously
- No trigger when lore was already >= N

Create `src/engine/__tests__/sagaSba.test.ts`:
- Saga with lore >= final chapter and no pending trigger → sacrificed
- Saga with lore >= final chapter but pending chapter trigger → NOT sacrificed
- Saga with lore < final chapter → NOT sacrificed
- Saga with no chapter abilities (finalChapter=0) → NOT sacrificed

## Constraints

- `src/engine/` is pure functions only — no React/DOM/Zustand imports.
- TypeScript strict, no `any`. Use `unknown` + type guards.
- UI text in Japanese; code/comments/identifiers in English.
- Do NOT modify `review.*` tests, `AGENTS.md`, `docs/`, ledger, or eslint config.
- Do NOT use git commands.
- Do NOT run `npm run check` (full check is judge-owned post-audit).
- Run only targeted tests: `npx vitest run src/engine/__tests__/sagaGrammar.test.ts src/engine/__tests__/sagaChapterTriggers.test.ts src/engine/__tests__/sagaSba.test.ts`
- Existing tests must not regress: `npx vitest run src/engine/__tests__/` (engine project only).

## Done when

1. `parseSagaChapters` and `finalChapterNumber` pass all grammar tests.
2. Chapter triggers fire correctly on ETB and turn-based lore increment.
3. SBA 714.4 sacrifices Sagas at final chapter (with pending-trigger exception).
4. Lore increment timing matches CR 714.3c (precombat main, not untap).
5. All engine tests green (`npx vitest run src/engine/__tests__/`).
6. Report: changed files, acceptance results, defers, unresolved points.
