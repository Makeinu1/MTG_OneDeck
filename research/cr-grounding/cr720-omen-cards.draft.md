# §34.53 CR720 Omen Cards — Design Contract (Judge Draft)

> Status: **drafted** (judge-owned). 実装者は本契約の範囲内でのみ実装する。
> CR refs: 720.2–720.4 (pinned CR 2026-06-19).
> dependsOn: cr-108-cards (shipped), cr-601-casting-stack (shipped).

## 1. CR grounding

| CR | Clause | Implementation |
|----|--------|----------------|
| 720.2 | Inset frame defines alternative characteristics usable while a spell. | Scryfall `omen` layout = 2 faces: face 0 normal, face 1 Omen characteristics. Existing faceIndex machinery carries the characteristics. |
| 720.3 | Casting an omen card: choose normal or Omen. | `castSpell`/`castToStack` gain `castAsOmen?: boolean`. Engine validates layout/face. |
| 720.3b | On the stack as an Omen, only alternative characteristics. | faceIndex=1 on the stack item → typeLineOf/currentFace already resolve face 1. |
| 720.3c | A copy of an Omen spell is an Omen with alternative characteristics. | `applyCopyStackItemOnce` copies `castAsOmen` + faceIndex. |
| 720.3d | As an Omen spell resolves, shuffle it into its owner's library instead of graveyard. | `defaultStackResolveDestination` override: `castAsOmen` → library + shuffle via `libraryShuffleOrder`. |
| 720.4 | Off-stack: only normal characteristics. | `resetCardForZoneChange` resets faceIndex→0 and clears `castAsOmen`. |
| 720.2a/720.5 | "has an Omen" references; choosing the alternative name. | Out of scope (no engine demand). |

## 2. State substrate

### 2.1 `CardInstance.castAsOmen?: boolean`

- Set on the stack item when cast as an Omen (parallel to `usingTeamwork`).
- Cleared by `resetCardForZoneChange` alongside `announcedX` (cast choices don't survive zone changes; countered Omen goes to graveyard as a normal card).
- Not copiable separately — copies inherit it explicitly (720.3c).

### 2.2 Command extensions

```ts
| { type: 'castSpell'; ...; castAsOmen?: boolean; libraryShuffleOrder?: string[] }
| { type: 'castToStack'; ...; castAsOmen?: boolean }   // (castToStack union member — extend existing)
```

- Validation: `castAsOmen === true` requires `def.layout === 'omen'` and the chosen `faceIndex === 1`; otherwise throw `EngineError('オメンとして唱えられるカードではありません。')`.
- `resolveStackTop` reuses the existing `libraryShuffleOrder` parameter: when the top is a castAsOmen spell, destination is the owner's library; the order (which must be a permutation of the library INCLUDING the incoming card) is applied as a shuffle. If no order is provided, move the card to the TOP of the library and push warning `「オメン呪文の解決にはライブラリのシャッフル順列が必要です(一番上に配置)。」` (honest degradation, same discipline as isPureSelfLibraryShuffleLine).
- `castSpell` (immediate resolve path): for `castAsOmen`, move to owner's library using `libraryShuffleOrder` if provided, else top + same warning.
- `applyRemoveStackItem` (counter): unchanged — Omen goes to graveyard normally (720.3d applies only to resolution).

## 3. Resolution destination override

In `applyResolveStackTop`, before computing `destination`:

```ts
if (card.castAsOmen === true) { move to library + shuffle per §2.2; log 「…を解決した(オメン: ライブラリへシャッフル)。」; apply compiled effects; return; }
```

The spell's compiled effects still apply from face 1 oracle text (existing `effectLinesForResolvedStackItem`/`stackItemRulesText` already use faceIndex).

## 4. Copy propagation (720.3c)

`applyCopyStackItemOnce` (non-ability branch): add `castAsOmen: source.castAsOmen` to the copy object.

Resolution of an Omen COPY (judge ruling 2026-08-04): CR 707.10a forbids a spell copy from
existing in any zone other than the stack, so 720.3d's shuffle cannot place a copy into the
library. The copy applies its effects and then ceases to exist (`moveCardInternal`'s existing
copy-deletion branch); no `libraryShuffleOrder` is consumed. Only physical cards are shuffled.

## 5. Out of scope (deferred)

- 720.2a "has an Omen" effect references; 720.5 alternative-name choice.
- Store/UI cast-choice dialog for omen faces (substrate only).
- Omen cards in the Scryfall cache pipeline (layout passthrough already exists).

## 6. Golden cases (judge-owned review test)

| ID | Scenario | CR | Expected |
|----|----------|-----|----------|
| O1 | castToStack as Omen | 720.3/720.3b | stack item has faceIndex 1, castAsOmen true; typeLine = Omen face |
| O2 | resolveStackTop of Omen spell with shuffle order | 720.3d | card in owner's library at shuffled position; not graveyard |
| O3 | resolveStackTop of Omen spell WITHOUT order | 720.3d | card on top of library + warning |
| O4 | countered Omen spell | 720.4 | graveyard; castAsOmen cleared; faceIndex 0 |
| O5 | copyStackItem of Omen spell | 720.3c | copy has castAsOmen true + faceIndex 1 |
| O6 | castSpell immediate Omen resolve | 720.3d | library destination (judge ruling 2026-08-04: `applyCast` performs only the zone move for immediate casts — identical to normal spells; compiled effects ride `castToStack` + `resolveStackTop`) |
| O7 | castAsOmen on non-omen card throws | — | EngineError |
| O8 | normal cast of omen card (face 0) | 720.3 | graveyard resolve path unchanged, no castAsOmen |

## 7. Invariants

- I57: `castAsOmen === true` only on stack objects (or copies thereof); off-stack cards never carry it after a zone change.

## 8. Deliverable files

| File | Change |
|------|--------|
| `src/engine/types.ts` | `CardInstance.castAsOmen?: boolean` |
| `src/engine/commands.ts` | cast validation, stack flag, resolve override, copy propagation, zone-change clear |
| `src/engine/__tests__/omenCards.test.ts` | implementer tests |
| `src/engine/__tests__/review.cr720-omen-cards.test.ts` | judge-owned review test |
