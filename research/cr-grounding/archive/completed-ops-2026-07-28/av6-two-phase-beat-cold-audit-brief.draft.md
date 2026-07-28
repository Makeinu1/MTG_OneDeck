# Cold Audit Brief — AV6 Two-Phase Rhythm + Dance-Floor Lighting

## Audit target

- **Domain**: AV6 (2-phase rhythm + dance-floor lighting)
- **Claimed status**: `implemented-not-audited` (seeking `audited`)
- **Contract**: `docs/audio-visual-contract.md` §11
- **Acceptance**: `docs/acceptance.md` M-AV6 (AV-53 through AV-63)
- **Evidence tests**: `src/components/game/__tests__/review.av6-two-phase-beat.test.ts` (34 tests)
- **Machine check**: `npm run check` (lint + vitest 2506 tests + build) — all green as of audit time

## Changed files

| File | Action |
|---|---|
| `src/components/game/presentation/twoPhaseBeat.ts` | Created — `commanderOnBattlefield()` + `lightPoolColors()` |
| `src/components/game/presentation/presentationTuning.ts` | Modified — `TwoPhaseBeatTuning` interface + 6 fields |
| `src/components/game/presentation/AudioVisualProvider.tsx` | Modified — sets/removes 6 AV6 CSS vars |
| `src/components/game/GameScreen.tsx` | Modified — phase attrs + stamp effect + DanceFloorLights mount |
| `src/components/game/GameCard.tsx` | Modified — `game-card--commander-idle` class |
| `src/components/game/DanceFloorLights.tsx` | Created — dance-floor lighting layer |
| `src/components/game/game.css` | Modified — 6 keyframes, phase selectors, dance-floor layer, reduced-motion/light-theme overrides. Removed old AV5 unscoped selectors. |
| `docs/audio-visual-contract.md` | Modified — §11 added |
| `docs/acceptance.md` | Modified — M-AV6 added |
| `docs/design-vision.md` | Modified — AV6 row added |

## Audit procedure

1. Run `npm run check` and confirm all three stages pass (lint, test, build).
2. Run `npx vitest run src/components/game/__tests__/review.av6-two-phase-beat.test.ts` and confirm 34/34 pass.
3. **Boundary verification**: Read `docs/audio-visual-contract.md` §11 and verify each MUST/STOP condition against the implementation:
   - No new `PresentationEvent.kind` (check `presentationEvents.ts`)
   - No audio imports in `twoPhaseBeat.ts` or `DanceFloorLights.tsx`
   - No BGM/BPM/filter changes
   - All animations are transform/opacity only (check AV6 keyframes in `game.css`)
   - `data-ambient='on'` gate present on all AV6 selectors
   - `prefers-reduced-motion` override present
   - Light-theme disable present
   - No per-frame JS loops (stamp is event-driven one-shot)
   - Tap-mute wins over all phases (specificity check)
4. **Spot-check**: Read `twoPhaseBeat.ts` and verify `commanderOnBattlefield` and `lightPoolColors` logic against §11 spec.
5. **Adversarial checks**:
   - Does the old AV5 unscoped selector removal break AV5 tests? Run `npx vitest run src/components/game/__tests__/review.av5-permanent-beat.test.ts`.
   - Does the CSS token guard still pass? Run `npx vitest run src/ui/__tests__/review.css-token-guard.test.ts`.
   - Can `lightPoolColors` return more than 5 colors? Can it return an empty array?
   - Does the stamp timer leak if the component unmounts mid-stamp?
   - Is `data-just-arrived` correctly cleaned up?

## Output format

For each check, report:
- **PASS** / **BLOCKER** / **HIGH** / **MEDIUM** / **LOW**
- Brief evidence (command output excerpt or code reference)

Final verdict: one of `SHIPPED-OK` / `BLOCKER` / `HIGH` / `MEDIUM` / `LOW` per domain.

## Constraints

- **Do NOT edit any files.** Findings only.
- Do NOT modify the contract, tests, or implementation.
- CR reference: not applicable (AV domain, no CR rules involved).
- Verify the status claim adversarially: "is this `implemented-not-audited` claim actually supported by the evidence, or are there gaps?"
