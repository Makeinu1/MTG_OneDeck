# Cold Audit Findings: cr-712-face-characteristics

Auditor: Codex cold auditor (GPT-5, no implementation context)
Date: 2026-08-02
Verdict: AUDIT-FAIL

## Summary

| Severity | Count |
|---|---|
| BLOCKER | 1 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |

## Findings

### BLOCKER-1 — `collectZoneChangePendingTriggers` self-death/self-leaves gate uses `defHasRuleTag` (no face filter), violating CR 712.8d

**Files:** `src/engine/triggers.ts` lines 1549 and 1592

The authoritative game-loop trigger path (`collectPendingTriggerUpdate`, consumed by
`gameStore.ts:767` and `priority.ts:290,307`) gates self-referential death and
leaves-battlefield triggers with `defHasRuleTag(next, event.before.defId, ...)`.
`defHasRuleTag` (line 138) checks whether *any* face of the card definition carries the
rule tag — it does **not** consult `event.before.faceIndex`.

Consequence: a DFC whose front face has no death/leaves trigger but whose back face does
(e.g. a werewolf with "When this creature dies, …" only on the back face) will generate a
phantom `PendingTrigger` when it dies with face 0 up. CR 712.8d states the permanent has
*only* the characteristics of the face that's up, so the back-face trigger must not fire.

The phantom trigger surfaces in the UI with a label ("死亡したとき: 《card》") and
`abilityLineIndex: undefined` (because `makePendingTrigger` → `abilityLineIndexForTriggerDef`
*is* face-filtered and finds no matching line on face 0). The user can still attempt to
resolve it, producing incorrect gameplay.

**Adversarial proof (run in /tmp, not committed):**

```
DFC: front = "Vigilance", back = "When this creature dies, return it transformed."
face 0 up → moveCard to graveyard → collectPendingTriggers returns 1 death trigger.
Expected: 0.  Actual: 1.  FAIL.
```

The same probe for `trigger.leaves` (front = "{T}: Add {G}", back = "When this creature
leaves the battlefield, draw a card") also fails: `collectPendingTriggers` returns a leaves
trigger while `detectTriggerCandidates` correctly returns none. The two paths disagree.

**Contrast with the correct path:** `detectTriggerCandidates` (line 413, 439) uses
`cardHasRuleTag` (line 79), which *does* filter by `card.faceIndex` via
`splitAbilityLines(def).filter(line => line.faceIndex === card.faceIndex)`. The
`collectZoneChangePendingTriggers` path should use an equivalent face-aware gate.

**Suggested fix direction (not implemented — auditor does not edit source):**
Replace `defHasRuleTag(next, event.before.defId, 'trigger.death')` at line 1549 (and the
analogous `'trigger.leaves'` at line 1592) with a face-aware check, e.g.
`triggeredAbilityEntries(next, event.before.defId, event.before.faceIndex).some(...)` or a
new `snapshotHasRuleTag(state, snapshot, tagId)` helper that mirrors `cardHasRuleTag` but
accepts an `ObjectSnapshot` instead of a live card id.

### MEDIUM-1 — `collectZoneChangePendingTriggers` self-cast gate also uses `defHasRuleTag` (no face filter)

**File:** `src/engine/triggers.ts` line 1626

```ts
if (defHasRuleTag(next, event.after.defId, 'trigger.cast') && !defHasRuleTag(next, event.after.defId, 'trigger.cast-watcher')) {
```

Same pattern as BLOCKER-1: the gate checks all faces, not the face being cast. A DFC with a
"when you cast" trigger on one face but not the other could produce a phantom cast trigger.

Severity is MEDIUM rather than BLOCKER because (a) self-referential cast triggers on DFCs
are extremely rare in practice, (b) the card is on the stack at this point (not a
battlefield permanent), and (c) `abilityLineIndexForTriggerDef` downstream is face-filtered,
so the phantom trigger would have no ability line index. No current gameplay impact is
likely, but the inconsistency with `detectTriggerCandidates` (which uses `cardHasRuleTag`
at line 506) is a correctness concern.

### LOW-1 — `faceDown` flag is not consulted in trigger detection

**File:** `src/engine/triggers.ts` (entire file — no reference to `faceDown`)

Per CR 707.2, a face-down permanent has no characteristics other than those defined by the
effect that turned it face down. The trigger detection paths do not check `card.faceDown`.
A face-down DFC would still have its face-index characteristics scanned.

This is LOW because: (a) the brief explicitly scopes this slice to "face filter in
trigger/activation candidate enumeration only" and face-down DFCs are out of scope;
(b) the engine's face-down support is a separate concern; (c) no current test or card
data exercises this path.

### LOW-2 — Review test file comment cites 712.8d but test header says "on the battlefield"

**File:** `src/engine/__tests__/review.cr712-8d-dfc-face-filter.test.ts` line 5

The comment reads "While a double-faced card is on the battlefield, consider only the
characteristics of the face that's currently up." The actual CR 712.8d text is "While a
double-faced *permanent* has its front face up, it has only the characteristics of its
front face." The paraphrase is close but conflates 712.8d (front face) with 712.8f (modal,
either face). No functional impact; documentation-only.

## Evidence log

### Review tests (all pass)

```
✓ review.cr712-8d-dfc-face-filter.test.ts — 4/4 pass
✓ doubleFacedCommanderResolution.test.ts — 3/3 pass
```

### Adversarial probes (run from /tmp, copied to repo temporarily, then deleted)

| Probe | Result |
|---|---|
| face-0 up, back-face death trigger, `collectPendingTriggers` | **FAIL** — 1 phantom trigger (expected 0) |
| face-1 up, back-face death trigger, `collectPendingTriggers` | PASS — trigger correctly fires |
| face-0 up, back-face leaves trigger, `detectTriggerCandidates` vs `collectPendingTriggers` | **FAIL** — paths disagree |
| `activatedAbilityLines(def)` without faceIndex (backward compat) | PASS — returns all faces |
| `activatedAbilityLines(def, 0)` / `(def, 1)` | PASS — correct face isolation |
| faceIndex=99 (out of bounds) → `abilityLineIndexForKind` | PASS — returns undefined, no crash |
| single-face card → `abilityLineIndexForKind` | PASS — resolves normally |
| faceDown=true, faceIndex=0 → `abilityLineIndexForKind` | PASS — face filter still applies |
| DFC back face → moveCard to hand → faceIndex resets to 0 (CR 712.8a) | PASS |
| DFC back face → moveCard to library → faceIndex resets to 0 (CR 712.8a) | PASS |

### Code paths verified as correctly face-filtered

- `cardHasRuleTag` (line 79): filters by `card.faceIndex` via `splitAbilityLines` — correct.
- `triggeredAbilityEntries` (line 179): accepts optional `faceIndex` param — correct.
- `abilityLineIndexForKind` (line 213): uses `card.faceIndex` for both activated and triggered — correct.
- `abilityLineIndexForTriggerDef` (line 256): accepts optional `faceIndex` — correct.
- `activatedAbilityLines` (grammar/index.ts line 215): accepts optional `faceIndex` — correct.
- `actionCatalog.ts` line 258: passes `card.faceIndex` to `activationSpecsForZone` — correct.
- `collectAttackDeclarationPendingTriggers`: uses `triggeredAbilityEntries(…, attacker.faceIndex)` — correct.
- `collectDrawPendingTriggers`, `collectLifeChangePendingTriggers`, `collectDamagePendingTriggers`, `collectCounterChangePendingTriggers`: all use `triggeredAbilityEntries(…, sourceSnapshot.faceIndex)` — correct.
- `matchingSelfEtbAbilityLineIndexes`, `matchingEtbOtherAbilityLineIndex`, `matchingDeathOtherAbilityLineIndex`: all use `triggeredAbilityEntries` with faceIndex — correct.
- `collectImplicitPendingTriggers`: uses `cardHasRuleTag` (face-filtered) — correct.

### Code paths with missing face filter

- `collectZoneChangePendingTriggers` line 1549: `defHasRuleTag(…, 'trigger.death')` — **no face filter** (BLOCKER-1).
- `collectZoneChangePendingTriggers` line 1592: `defHasRuleTag(…, 'trigger.leaves')` — **no face filter** (BLOCKER-1).
- `collectZoneChangePendingTriggers` line 1626: `defHasRuleTag(…, 'trigger.cast')` — **no face filter** (MEDIUM-1).
