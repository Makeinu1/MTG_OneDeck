# SFX v2 cold-audit brief — volume sliders, louder SFX, commander redesign

## Claim under adversarial review

The 2026-07-26 SFX v2 improvement is claimed to satisfy the updated
`docs/audio-visual-contract.md` §3.1 (volume sliders, raised SFX levels,
commander timbre redesign with sawtooth/triangle + filters, osc-layer filter
support). It is `implemented-not-audited`. Adversarially test the claim.

Human listening gates remain outside this audit.

## Required reading

- `AGENTS.md`
- `docs/audio-visual-contract.md` §3.1
- `src/components/game/presentation/sfxPatches.ts`
- `src/components/game/presentation/sfxRenderer.ts`
- `src/components/game/presentation/audioVisualPreferences.ts`
- `src/components/game/presentation/AudioVisualProvider.tsx`
- `src/components/game/presentation/musicBus.ts`
- `src/components/game/presentation/audioVisualSession.ts`
- `src/components/game/ThumbZone.tsx`
- `src/components/game/game.css` (volume slider styling)
- `src/components/game/__tests__/review.av0-contract.test.ts`
- `src/components/game/__tests__/review.av3-semantic-runtime.test.ts`
- `src/components/game/__tests__/review.av4-commander-ritual.test.ts`

## Adversarial checks

### Volume sliders

1. Verify `AudioPreferences` has optional `bgmVolume`/`sfxVolume` (0-100).
2. Verify defaults are 70/80 when missing.
3. Verify backward compat: stored prefs without volume fields parse correctly.
4. Verify sliders exist in ThumbZone with data-testid `menu-bgm-volume`/`menu-sfx-volume`.
5. Verify BGM gain scales by volume (musicBus `setMusicVolume`).
6. Verify SFX gain scales by volume (audioVisualSession `setSessionSfxVolume`).
7. Verify light theme / non-game / pre-gesture still produces zero output
   regardless of slider values.

### SFX levels

1. Verify SFX_LEVELS_DB = -8/-6/-10/-3 matching contract §3.1.
2. Verify review pins assert these exact values.

### Commander timbre redesign

1. Verify commander patch has >= 12 layers.
2. Verify at least one sawtooth layer exists (not all sine).
3. Verify at least one noise layer exists (riser).
4. Verify G4(392)/B4(493.88)/D5(587.33) pitches are preserved.
5. Verify durationMs <= 650.
6. Verify reverb wet >= 0.35 and decay >= 0.9.

### Osc-layer filter support

1. Verify sfxRenderer applies BiquadFilterNode to osc layers when filterType is set.
2. Verify filter frequency ramp and Q are supported.
3. Verify osc layers without filterType still connect directly.

### Evidence

1. Run `npm run check`.
2. Verify all review pins pass.
3. Check `git diff --check`.

## Output

Findings only, ordered by severity. End with:
`SFX-V2: SHIPPED-OK` or the highest finding severity.
Then `HUMAN GATES: PENDING`.

## Constraints

- No file edits. No git mutation. Findings only.
- Do not infer audio quality from metadata.
