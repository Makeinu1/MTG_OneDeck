# ACT-2 起動ラインの選択と強行(UI到達性) — Scoping Draft

**Document Version**: 2026-07-17
**Status**: Design probe & coverage analysis
**Scope**: activation line enumeration UI, cost label generation, force flow, CR anchoring

## 1. Coverage Probe: Activated Ability Lines in MyDeck & Corpus

### MyDeck Coverage

4デッキ(Celes, Gogo, Kefka, Muldrotha)における起動能力行(activated shape)が2本以上のカード:

- **MyDeck unique cards with 2+ activated lines: 48**

**Representative sample by deck:**

| Deck | Count | Examples |
|------|-------|----------|
| Celes | 13 | Plaza of Heroes (4 lines), Talisman of Conviction (2), Battlefield Forge (2) |
| Gogo | 11 | Ipnu Rivulet (3), Basalt Monolith (2), Deserted Temple (2) |
| Kefka | 18 | Mount Doom (3), Daily Bugle Building (3), Arena of Glory (2) |
| Muldrotha | 6 | Aether Spellbomb (2), Phyrexian Tower (2), Shifting Woodland (2) |

**Corpus Coverage (all 17,491 cards):**
- Cards with 2+ activated lines: **946 (5.41%)**
- Distribution: 834 with 2 lines, 97 with 3 lines, 12 with 4 lines, 3 with 5 lines
- Majority: dual-tap artifact/land mana sources (90%+)

### Key Example: Plaza of Heroes

```
Oracle text:
{T}: Add {C}.
{T}: Add one mana of any color. Spend this mana only to cast a legendary spell.
{T}: Add one mana of any color among legendary permanents you control.
{3}, {T}, Exile this land: Target legendary creature gains hexproof and indestructible until end of turn.

Activated lines (4):
  [0] {T}: Add {C}.
  [1] {T}: Add one mana of any color. Spend this mana only to cast a legendary spell.
  [2] {T}: Add one mana of any color among legendary permanents you control.
  [3] {3}, {T}, Exile this land: Target legendary creature gains hexproof and indestructible until end of turn.
```

---

## 2. Current Implementation Status & Constraints

### splitAbilityLines & abilityShapesForKind

```typescript
// src/engine/grammar/index.ts:148-171
export function splitAbilityLines(def: CardDef): AbilityLine[] {
  // Returns all ability lines (triggered, activated, static, etc.) per face
  // Classifies each line by shape via classifyAbilityShape()
}

// src/engine/triggers.ts:167-183
export function abilityLineIndexForKind(
  state: GameState,
  sourceId: string,
  kind: AbilityKind,
): number | undefined {
  const shapes = abilityShapesForKind(kind);  // 'activated' → ['activated']
  const matches = splitAbilityLines(def)
    .map((line, index) => ({ line, index }))
    .filter((entry) => shapes.includes(entry.line.shape));

  // ⚠️ BOTTLENECK: returns index ONLY if exactly 1 match; undefined if 2+
  return matches.length === 1 ? matches[0].index : undefined;
}
```

### Current UI Flow (single-line fallback)

```
actionCatalog.ts:222
  ↓ (one generic 'ability-activate' action)
gameController.tsx:562
  store.activateAbility(cardId)   // ← no lineIndex passed
    ↓
gameStore.ts:2847
  abilityLineIndexForKind(cur, sourceId, 'activated')
    ↓ (returns undefined if 2+ lines exist)
  plan = activationPlanForSource(cur, sourceId, undefined)
    ↓ (tries to infer lineIndex, often fails for multi-line cards)
```

### Constraint: CR 602.2 Atomicity & Cost Verification (CR 118.3)

**CR 602.1** (line 10, rule/601.2a): "activated ability = [Cost]: [Effect]"
**CR 602.2a** (line 13, rule/602.2a): "activation = put ability on stack + pay costs atomically"
**CR 118.3** (line 10, rule/118.3): "cost can't be paid without full resources; no partial payment"

→ **Must not allow cost evaluation before line selection** (or state mutation would leak).
→ Force dialog **only after user picks a specific line**.

---

## 3. Design Recommendation: Single Recognizer

### Goal: Prevent Desync Between Engine & UI

Following **a902a9f** teachin (recognition path unification), define a single export function that both compile-time and UI-layer use:

```typescript
// src/engine/grammar/index.ts (proposed)

export function activatedAbilityLines(def: CardDef): Array<{
  index: number;
  text: string;
  costPrefix: string;  // text before ':' (e.g. "{T}", "{2}{T}", "{3}, {T}, Exile")
}> {
  const allLines = splitAbilityLines(def);
  return allLines
    .map((line, index) => ({ line, index }))
    .filter(entry => entry.line.shape === 'activated')
    .map(entry => {
      const colonPos = entry.line.text.indexOf(':');
      const costPrefix = colonPos > 0 
        ? entry.line.text.slice(0, colonPos).trim()
        : '';
      return {
        index: entry.index,
        text: entry.line.text,
        costPrefix,
      };
    });
}
```

**Usage:**
- Engine compile-time: guard against missing lineIndex when >1 activated line exists
- UI: iterate over result array to build per-line action entries

**Placement**: src/engine/grammar/index.ts (colocated with splitAbilityLines)

---

## 4. Cost String Label Generation

### Cost Parsing Existing Foundation

splitAbilityLines already extracts the full text; cost is the colon-left segment:

```typescript
// Example from Plaza of Heroes line [2]:
"Add one mana of any color among legendary permanents you control."
costPrefix = "{T}"

// Example from Plaza of Heroes line [3]:
"Target legendary creature gains hexproof and indestructible until end of turn."
costPrefix = "{3}, {T}, Exile"
```

### Label Generation (UI Layer)

```typescript
// src/components/game/actionCatalog.ts (proposed helper)

function activationLineLabel(costPrefix: string, effectText: string): string {
  // Trim reminder text and excess whitespace
  const effectStart = effectText.slice(costPrefix.length + 1).trim();
  const effectPreview = effectStart.substring(0, 60);
  return `${costPrefix}: ${effectPreview}${effectStart.length > 60 ? '…' : ''}`;
}

// Usage in catalog:
// costPrefix = "{T}"
// effectText = "{T}: Add {C}."
// → label = "{T}: Add {C}."
//
// costPrefix = "{3}, {T}, Exile"
// effectText = "{3}, {T}, Exile this land: Target legendary creature…"
// → label = "{3}, {T}, Exile: Target legendary creature…"
```

**CR Grounding:**
- **CR 602.1**: cost is exactly what appears left of the colon in oracle text
- Not responsible for user understanding of modal alternatives; text truncation is visual-only

---

## 5. Force Flow: costWarnings → Dialog Reflow

### Current Blocking Point (gameStore.ts:2982-2985)

```typescript
const costWarnings = activationCostWarnings(cur, pendingActivation);
if (paymentMode === 'rules-legal' && costWarnings.length > 0) {
  set({ warnings: [...get().warnings, ...costWarnings], pendingGuided: null });
  return;  // ⚠️ BLOCKS activation; never reaches target picker
}
```

### New Flow: Force Dialog Before Confirmation

**Option A: Inline Dialog (minimal state)**

```typescript
// src/components/game/dialogs.tsx (proposed)

// Reuse ShortfallDialog pattern (dialogs.tsx:53-82)
export function CostWarningDialog(props: {
  warnings: string[];
  onForce: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={true} onClose={props.onCancel}>
      <DialogTitle>警告</DialogTitle>
      <DialogContent>
        <ul>{props.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          強行すると、このターン中のマナ/ライフコストは支払えないものとして扱われます。
        </p>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onCancel}>キャンセル</Button>
        <Button onClick={props.onForce} variant="contained" color="error">
          強行する
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

**Option B: Store State (full integration)**

```typescript
// src/store/gameStore.ts interface (proposed)

interface GameStoreState {
  // …existing fields…
  pendingForceActivation?: {
    sourceId: string;
    abilityLineIndex: number;
    costWarnings: string[];
  };
}

// In activateAbility():
if (paymentMode === 'rules-legal' && costWarnings.length > 0) {
  set({
    pendingForceActivation: {
      sourceId,
      abilityLineIndex: resolvedAbilityLineIndex,
      costWarnings,
    },
  });
  return;
}

// New method:
confirmForceActivation(): void {
  const pend = get().pendingForceActivation;
  if (!pend) return;
  const cur = get().state!;
  get().activateAbility(pend.sourceId, pend.abilityLineIndex, { force: true });
  set({ pendingForceActivation: undefined });
}
```

**Recommendation**: **Option B** (store-owned) for consistency with Tier-2 audit trail (logging which activations were forced).

---

## 6. ACT-1 Carry: needs-choice Color Dialog Unification

### Current Dual Implementation (ACT-1 leftover)

Four locations attempt mana-choice dialogs **independently** of naiveTapManaColors pattern:

| Location | File | Lines | Pattern |
|----------|------|-------|---------|
| Guided mana tap | gameController.tsx | 451–480 | Manual color picker (ColorSelection) |
| Mana shortfall | gameController.tsx | 508–525 | Manual color picker (ColorSelection) |
| Playmat cost header | Playmat.tsx | 245–265 | Derived needs via filter |
| Manual mana dialog | dialogs.tsx | 110–145 | Semi-hardcoded W/U/B/R/G list |

**naiveTapManaColors existing pattern** (src/engine/grammar/manaShortcut.ts):
```typescript
export function naiveTapManaColors(lineText: string): ManaColor[] {
  // Parses cost string, extracts required colors, returns [W, U, B, R, G] filtered
}
```

### Proposed Unification (ACT-1 scope, not ACT-2)

```typescript
// src/components/game/dialogs.tsx (proposed helper)

function needsChoiceManaColors(state: GameState, sourceId: string, abilityLineIndex?: number): ManaColor[] {
  const card = state.cards[sourceId];
  if (!card) return [];
  
  const def = state.defs[card.defId];
  if (!def) return [];
  
  const lines = splitAbilityLines(def);
  const targetLine = abilityLineIndex !== undefined ? lines[abilityLineIndex] : undefined;
  if (!targetLine || targetLine.shape !== 'activated') return [];
  
  return naiveTapManaColors(targetLine.text);  // ← single source
}

// Apply to 4 locations:
// 1. gameController.tsx:453 → needsChoiceManaColors(state, sourceId, guidedIdx)
// 2. gameController.tsx:510 → needsChoiceManaColors(state, sourceId, activationIdx)
// 3. Playmat.tsx:248 → needsChoiceManaColors(state, cardId)
// 4. dialogs.tsx:112 → needsChoiceManaColors(state, sourceId)
```

**This is separate from ACT-2 scope** but touches actionCatalog + dialogs refactor.

---

## 7. engine-spec §34 Addendum Draft

### 34.XX actionCatalog Activation Enumeration

> When a card has multiple activated ability lines (defined by splitAbilityLines() returning >1 entry with shape='activated'), the action catalog must enumerate each line separately. Each entry includes:
> - Stable id: `activation-line-{index}`
> - Label: cost prefix + effect preview (first 60 chars)
> - Handler: `activateAbility(cardId, lineIndex)`
>
> A single-line card (or no activated lines) routes through the existing `ability-activate` generic action.
>
> **CR 602.2 Atomicity**: target selection and cost payment are atomic (CR 602.2a); no state mutation occurs until the user confirms both target and cost intention. If cost warnings exist (CR 118.3 unpayability), the UI prompts for forced payment before target picker.

### 34.YY Force Activation Flow

> An activated ability may be forced through UI dialog if cost warnings exist (e.g., unpayable {T} on already-tapped source). Forced activation:
> 1. Routes through cost-warning dialog (Tier-2 non-CR-legal flag in log)
> 2. Calls activateAbility(sourceId, lineIndex, { force: true })
> 3. Marks state with `paymentMode: 'forced'` in PendingActivation
> 4. Proceeds to target picker (if any) with no further cost checks
>
> **CR 602.2 / 118.3 Grounding**: forced payment bypasses resource checks but maintains atomicity (stack object created only after full user confirmation).

---

## 8. Review Test Idiom Summary

### Fixture Helpers (for judge authoring review.* tests)

| Helper | Location | Usage | Notes |
|--------|----------|-------|-------|
| `makeDef()` | src/engine/__tests__/helpers.ts | Create CardDef with scryfallId, typeLine, faces[].oracleText | No Scryfall API call |
| `makeDeck()` | src/engine/__tests__/helpers.ts | Create N filler cards | Used to meet deck size requirements |
| `useGameStore.setState()` | src/store/gameStore.ts | Reset store state (state=null, warnings=[], etc.) | **MUST call before each test** |
| `instanceId(defId)` | test body (define locally) | Find card instance by defId | Maps def reference to game card |
| `toBattlefield(cardId)` | test body (define locally) | moveCard(cardId, 'battlefield', 'bottom') | Fixture setup only |
| `store().activateAbility(sourceId, lineIndex)` | gameStore API | Test activation with explicit line index | Pass undefined to trigger auto-inference |

### Example Pattern (from review.activated-envelope.test.ts:50–95)

```typescript
describe('review.some-feature', () => {
  beforeEach(() => {
    useGameStore.setState({ state: null, warnings: [], /* …full reset… */ });
  });

  it('CR 602.2: description here', () => {
    const src = makeDef({
      scryfallId: 'unique-id',
      typeLine: 'Artifact | Creature | Land',
      faces: [{ name: 'Card Name', typeLine: '…', oracleText: '…' }],
    });
    store().newGame([{ def: src, isCommander: false }, ...makeDeck(10)], 1);
    const srcId = instanceId('unique-id');
    toBattlefield(srcId);
    
    // Test body
    store().activateAbility(srcId, 0);  // Activate line index 0
    expect(store().state!.zones.stack).toHaveLength(1);
  });
});
```

**Key constraints:**
- `makeDef()` **does not** call Scryfall; oracle text must be hand-crafted
- Each test must reset store state in `beforeEach` (no shared mutable state)
- Use `store().state!.zones.stack` to verify stack mutations
- Target confirmation via `store().confirmGuidedTarget(targetCardId)`

---

## 9. Carry-Forward: ACT-1 Remaining (Outside ACT-2)

- [ ] Unify 4 needs-choice mana color dialogs to naiveTapManaColors pattern (§6)
- [ ] Consider stricter CR 602.2 validation in activationPlanForSource (resource atomicity audit)
- [ ] Expand engine-spec §34 with Slot 6 (error envelopes) for multi-line activation failures

---

## 10. Summary Table: Decisions to Judge

| Decision | Scope | Options | Recommendation |
|----------|-------|---------|-----------------|
| Recognizer function | new export | Single activatedAbilityLines() | Define in src/engine/grammar/index.ts |
| Cost label | UI layer | Truncate effect text to 60 char | Implement in actionCatalog.ts |
| Force dialog | State management | Option A (inline) vs Option B (store) | **Option B** (audit trail) |
| needs-choice unification | UI consistency | Refactor 4 locations | ACT-1 scope, defer to later commit |

---

## 11. Files to Modify (ACT-2 scope)

1. **src/engine/grammar/index.ts** — Add activatedAbilityLines() export
2. **src/components/game/actionCatalog.ts** — Enumerate multi-line activated abilities
3. **src/components/game/gameController.tsx** — Route per-line actions, handle force dialog
4. **src/store/gameStore.ts** — Add pendingForceActivation state, confirmForceActivation() method
5. **src/components/game/dialogs.tsx** — CostWarningDialog component (Option B flow)
6. **docs/engine-spec.md** — §34.XX and §34.YY addenda (judge-written, not implementation)

---

**Document Status**: Ready for judge review + CR citation validation.
**Next Step**: Judge confirms CR anchoring (600–607 rule refs), then implementation sprint ACT-2 begins.
