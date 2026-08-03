# §34.51 CR716 Class Cards — Design Contract (Judge Draft)

> Status: **drafted** (judge-owned). 実装者は本契約の範囲内でのみ実装する。
> CR refs: 716.1–716.4 (pinned CR 2026-06-19).
> dependsOn: cr-602-activated-abilities (shipped), cr-604-611-612-613-layers-continuous (shipped).

## 1. CR grounding

| CR | Clause | Implementation |
|----|--------|----------------|
| 716.2 | A class level bar = keyword ability representing an activated ability + a static ability. | `classGrammar.ts` parses level bars; static half feeds Layer 6; activated half feeds `setClassLevel` command. |
| 716.2a | "[Cost]: Level N — [Abilities]" = "[Cost]: This Class's level becomes N. Activate only if this Class is level N-1 and only as a sorcery" + "As long as this Class is level N or greater, it has [abilities]." | Activation gate: `classLevelOf(state, id) === N-1` + sorcery speed (store). Static gate: `classLevelOf(state, id) >= N`. |
| 716.2b | Level is a designation, not a counter. Not copiable. Retained if stops being a Class. | `CardInstance.classLevel?: number`. Not in `counters`. Not copied by `ObjectSnapshot`. |
| 716.2c | "to gain a Class level" = "to activate an ability indicated by a class level bar". | Informational; no separate command. |
| 716.2d | Permanent without a level → treated as level 1. | `classLevelOf()` returns `card.classLevel ?? 1`. |
| 716.3 | Abilities not preceded by a class level bar are treated normally. | Top-section lines pass through existing `splitAbilityLines` / `staticAbilityLinesForCurrentFace` unchanged. |
| 716.4 | Level counters ≠ class levels. No interaction. | `addCounters` with `counterType: 'level'` does NOT read/write `classLevel`. `classLevelOf` does NOT read `counters`. |

## 2. State substrate

### 2.1 `CardInstance.classLevel?: number`

- Optional field on `CardInstance` (types.ts). `undefined` = no explicit level set = treated as 1 by accessor.
- Only meaningful for battlefield permanents with Class type, but the field is type-agnostic (CR 716.2b: retained if stops being a Class).
- NOT a counter. NOT copied by `ObjectSnapshot` (not copiable, CR 716.2b).
- `resetCardForZoneChange` resets `classLevel` to `undefined` (judge ruling 2026-08-03, cold-audit FINDING-2): a zone change creates a new object with no memory per CR 400.7, so a bounced/blinked/re-cast Class re-enters at level 1 (CR 716.2d). CR 716.2b's "A Class retains its level even if it stops being a Class" applies to type-changing effects on the battlefield, NOT to zone changes.

### 2.2 `GameCommand.setClassLevel`

```ts
| { type: 'setClassLevel'; cardId: string; level: number }
```

- Sets `card.classLevel = cmd.level` (absolute, not delta).
- Validation (judge ruling 2026-08-03, cold-audit FINDING-3): `cmd.level` must be an integer >= 1; otherwise throw `EngineError`. Invariant I51 (`classLevelOf >= 1`) holds because the sole write path rejects invalid values.
- Log: `${name}のクラスレベルを${level}にしました。`
- No event emission in this slice (no trigger substrate for "level becomes N" yet).
- Idempotent: if `card.classLevel === cmd.level`, no state change, no log.

### 2.3 Backfill

- `normalizeSnapshotState`: no explicit backfill needed — `classLevel` is optional and `classLevelOf` defaults to 1. Old snapshots simply lack the field.
- `SNAPSHOT_VERSION` unchanged.

## 3. Grammar: `classGrammar.ts`

New module `src/engine/classGrammar.ts` (parallel to `sagaGrammar.ts`).

### 3.1 Types

```ts
export interface ClassLevelBar {
  /** The level number N in "{Cost}: Level N — [Abilities]" */
  level: number;
  /** The activation cost text before the colon, e.g. "{1}{R}" */
  costText: string;
  /** The abilities text after the em-dash */
  abilitiesText: string;
}
```

### 3.2 Parser: `parseClassLevelBars(oracleText: string | undefined | null): ClassLevelBar[]`

- Splits oracle text by `\n`, trims each line.
- Matches lines of the form `{Cost}: Level N — [Abilities]` using regex:
  `/^(.+):\s*Level\s+(\d+)\s*[—–-]\s*(.+)$/i`
- Returns bars in oracle-text order.
- Non-matching lines (top-section static abilities, flavor) are ignored.
- Empty/missing oracleText → `[]`.

### 3.3 Helper: `classLevelBarKeywords(bars: ClassLevelBar[], level: number): string[]`

- For each bar where `bar.level <= level`, extract keyword identifiers from `bar.abilitiesText`.
- Uses the same keyword vocabulary as `effectiveKeywords` (the `Keyword` union + `isKeyword` guard).
- Returns deduplicated keyword strings.
- Non-keyword abilities in the text are honestly ignored (deferred to a future ability-granting slice).

## 4. Accessor: `classLevelOf(state: GameState, cardId: string): number`

- Exported from `status.ts`.
- Returns `state.cards[cardId]?.classLevel ?? 1` (CR 716.2d).
- Pure read; no zone restriction (designation persists per CR 716.2b).

## 5. Layer 6 extension: `effectiveKeywords`

- After the existing `forEachAdditiveStaticSourceLine` loop, add a Class-level-bar pass:
  - If the card's type line includes `'Class'` (via `currentTypeLine`), parse `parseClassLevelBars(oracleText)`.
  - For each bar where `bar.level <= classLevelOf(state, cardId)`, extract keywords via `classLevelBarKeywords`.
  - Append to the `granted` array before `normalizeKeywords`.
- This is self-only (a Class grants keywords to itself), consistent with CR 716.2a's "it has [abilities]".
- Attached-object Class keyword grants are out of scope (no known cards do this).

## 6. Activation integration (store-level, minimal)

- The existing `activateAbility` path in `gameStore.ts` already handles sorcery-speed warnings via `sorcerySpeedWarning`.
- Class level bar activations are recognized by the grammar: `splitAbilityLines` already splits oracle text into lines; class level bar lines (`{Cost}: Level N — ...`) are already split as ability lines.
- The activation gate (`classLevelOf === N-1`) is enforced at the engine level: a new exported function `classLevelActivationLegal(state, cardId, barLevel): boolean` in `classGrammar.ts` or `status.ts`.
- Store integration: `activateAbility` checks `classLevelActivationLegal` before proceeding. If illegal, push warning `「${name}のレベル${N}能力は、現在のレベル${current}では起動できません。」` and return.
- On successful activation resolution, the store issues `setClassLevel` command with the bar's level.
- **Sorcery speed**: Class level bars are inherently sorcery-speed (CR 716.2a). The existing `sorcerySpeedWarning` infrastructure handles this if the activation is tagged appropriately. If the existing path does not naturally tag class level bars as sorcery-speed, add a minimal check.

## 7. Scope boundary (NOT in this slice)

- Non-keyword ability granting from level bars (triggered abilities, activated abilities, static P/T modifications) → deferred. `classLevelBarKeywords` honestly ignores non-keyword text.
- Level counter interaction (CR 716.4 leveler cards) → no interaction by design; no code needed.
- "to gain a Class level" trigger condition → no trigger substrate yet.
- Class type removal / type-changing effects interacting with classLevel → designation persists (CR 716.2b), no code needed.
- UI rendering of class level bars (striated text box) → out of scope.
- `ObjectSnapshot` / copy effects → classLevel is not copiable (CR 716.2b), no code needed.

## 8. Golden cases (review test)

All cases use synthetic `CardDef` fixtures (no Scryfall dependency).

| # | Case | CR | Expectation |
|---|------|----|-------------|
| G1 | Class enters battlefield, no level set | 716.2d | `classLevelOf` returns 1 |
| G2 | `setClassLevel` to 2 | 716.2a | `classLevelOf` returns 2; log emitted |
| G3 | `setClassLevel` idempotent (same level) | — | No state change, no log |
| G4 | Level bar keyword grant at level 1 (bar level 2) | 716.2a | Keyword NOT in `effectiveKeywords` |
| G5 | Level bar keyword grant at level 2 (bar level 2) | 716.2a | Keyword IS in `effectiveKeywords` |
| G6 | Level bar keyword grant at level 3 (bar level 2) | 716.2a | Keyword IS in `effectiveKeywords` (level >= N) |
| G7 | Multiple bars: level 2 grants flying, level 3 grants haste; at level 2 | 716.2a | flying yes, haste no |
| G8 | Multiple bars at level 3 | 716.2a | flying yes, haste yes |
| G9 | Non-Class permanent with classLevel set | 716.2b | `classLevelOf` returns the set value (designation persists) |
| G10 | Level counters do not affect classLevel | 716.4 | `addCounters('level', 3)` does not change `classLevelOf` |
| G11 | Top-section ability unaffected by class level | 716.3 | Top-section keyword always active regardless of classLevel |
| G12 | `parseClassLevelBars` parses real Rogue Class text | 716.2 | Correct level numbers, cost text, abilities text |
| G13 | `parseClassLevelBars` ignores non-bar lines | 716.3 | Top-section text not parsed as bars |
| G14 | `classLevelActivationLegal`: level 1, bar level 2 → legal | 716.2a | true |
| G15 | `classLevelActivationLegal`: level 2, bar level 2 → illegal | 716.2a | false (must be N-1) |
| G16 | `classLevelActivationLegal`: level 1, bar level 3 → illegal | 716.2a | false (must be N-1, not N-2) |
| G17 | Snapshot round-trip: classLevel preserved | 716.2b | normalizeSnapshotState retains classLevel |

## 9. Invariants

- I51: `classLevelOf(state, id) >= 1` for any card in state (CR 716.2d default).
- I52: `setClassLevel` is absolute (not additive); applying level N then level M yields M.
- I53: `classLevel` is independent of `counters` (CR 716.4).
- I54: `effectiveKeywords` for a Class at level L includes exactly the keywords from bars with `bar.level <= L`, plus printed/manual/attached keywords.

## 10. Files touched (expected)

| File | Change |
|------|--------|
| `src/engine/classGrammar.ts` | NEW: parser + types + activation legality |
| `src/engine/types.ts` | `CardInstance.classLevel?: number` |
| `src/engine/commands.ts` | `setClassLevel` command case |
| `src/engine/status.ts` | `classLevelOf` accessor; `effectiveKeywords` Class-bar extension |
| `src/engine/__tests__/review.cr716-class-cards.test.ts` | Judge-owned review test (G1–G17) |
| `src/engine/__tests__/classGrammar.test.ts` | Implementer-owned unit test |
| `src/store/gameStore.ts` | Minimal activation gate integration |
| `src/store/__tests__/classActivation.test.ts` | Implementer-owned store test |
| `docs/engine-spec.md` | §34.51 section (judge-owned, post-audit) |

## 11. Acceptance

1. `review.cr716-class-cards.test.ts` all green (judge-owned, implementer must not modify).
2. Implementer's own tests green.
3. `npm run check` green (post-audit, release fingerprint).
4. No `SNAPSHOT_VERSION` / `CACHE_SCHEMA_VERSION` change.
5. No UI changes.
6. Existing review tests unmodified and green.
