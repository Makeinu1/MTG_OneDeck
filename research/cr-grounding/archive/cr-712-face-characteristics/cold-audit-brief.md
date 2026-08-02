# Cold Audit Brief: cr-712-face-characteristics

## Domain

- ID: `cr-712-face-characteristics`
- CR refs: 712.8d, 712.8f, 712.11b
- Lane: leaf-compiler
- Status under audit: `implemented-not-audited`
- Implementation commit: `24d203a` (fix: DFC面フィルタ(CR712.8d)を誘発検出へ適用)
- Candidate tree HEAD: `4825230`

## Contract

CR 712.8d: While a double-faced permanent has its front face up, it has only the characteristics of its front face.
CR 712.8f: While a modal double-faced permanent is on the battlefield, it has only the characteristics of the face that's up.

Consequence for this engine: trigger detection (`detectTriggerCandidates`), ability line indexing (`abilityLineIndexForKind`, `abilityLineIndexForTriggerDef`), and activated ability enumeration (`activatedAbilityLines`) must filter by `card.faceIndex` so that back-face abilities never appear as candidates when the front face is up (and vice versa).

## Boundary

- This slice covers the face filter in trigger/activation candidate enumeration only.
- Transform/convert automation, meld cards (712.4), and full DFC lifecycle are explicitly out of scope.
- MDFC cast choice (712.11b) is covered by the pre-existing `doubleFacedCommanderResolution.test.ts`.

## Evidence to verify

1. `src/engine/__tests__/review.cr712-8d-dfc-face-filter.test.ts` — 4 cases, all must pass.
2. `src/engine/__tests__/doubleFacedCommanderResolution.test.ts` — 3 cases, all must pass.
3. `src/engine/triggers.ts` — face filter in `detectTriggerCandidates`, `triggeredAbilityEntries`, `abilityLineIndexForKind`, `abilityLineIndexForTriggerDef`.
4. `src/engine/grammar/index.ts` — `activatedAbilityLines(def, faceIndex?)` filters by face.
5. `src/components/game/actionCatalog.ts` — passes `card.faceIndex` to `activatedAbilityLines`.

## Adversarial probes the auditor should run

- Construct a DFC with face 0 up. Verify back-face triggered abilities do NOT appear in `detectTriggerCandidates` output.
- Construct a DFC with face 1 up (via `setFace`). Verify front-face triggered abilities do NOT appear.
- Construct an MDFC land with different activated abilities on each face. Verify `abilityLineIndexForKind(state, id, 'activated')` returns exactly one index, not undefined.
- Verify that `activatedAbilityLines(def)` without faceIndex still returns all faces (backward compat for non-DFC callers).
- Check that `faceIndex` resets to 0 on zone change (graveyard, hand, library) per 712.8a.

## Deliverable

Write findings to `research/cr-grounding/archive/cr-712-face-characteristics/cold-audit-findings.md` using the standard format (severity table + per-finding detail). Do NOT edit any source files.
