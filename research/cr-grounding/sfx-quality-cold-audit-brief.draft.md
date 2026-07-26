# SFX quality improvement cold-audit brief

## Claim under adversarial review

The 2026-07-26 SFX quality improvement is claimed to satisfy
`docs/audio-visual-contract.md` §3.1 (OfflineAudioContext multi-layer patch synthesis).
It is `implemented-not-audited`. Adversarially test the claim; do not confirm it.

Human listening gates remain outside this audit. Do not infer audible quality from
passing code or metadata.

## Required reading

- `AGENTS.md`
- `docs/audio-visual-contract.md` §3, §3.1, §4, §5
- `src/components/game/presentation/sfxPatches.ts`
- `src/components/game/presentation/sfxRenderer.ts`
- `src/components/game/presentation/SemanticPresentationLayer.tsx`
- `src/components/game/presentation/CommanderRitualLayer.tsx`
- `src/components/game/presentation/commanderRitual.ts`
- `src/components/game/presentation/semanticSound.ts`
- `src/components/game/presentation/audioVisualSession.ts`
- `src/components/game/presentation/AudioVisualProvider.tsx`
- `src/components/game/game.css` (ambient-heart-throb keyframes)
- `src/components/game/__tests__/review.av3-semantic-runtime.test.ts`
- `src/components/game/__tests__/review.av4-commander-ritual.test.ts`
- `src/components/game/presentation/__tests__/sfxPatches.test.ts`
- `src/components/game/presentation/__tests__/sfxRenderer.test.ts`

## Adversarial checks

### Patch data (sfxPatches.ts)

1. Verify `sfxPatch(kind)` is deterministic (same output across calls).
2. Verify all four kinds exist and have >=2 layers (ordinary) / >=4 layers (commander).
3. Verify commander patch durationMs <= 650.
4. Verify SFX_LEVELS_DB matches contract §3.1 values (-13/-11/-15/-8).
5. Verify no Math.random or non-deterministic source in the module.
6. Verify commander motif preserves G4(392)/B4(493.88)/D5(587.33) pitch structure.

### Renderer (sfxRenderer.ts)

1. Verify OfflineAudioContext is used for rendering (not runtime oscillators).
2. Verify noise generation uses a deterministic PRNG (no Math.random).
3. Verify reverb uses convolution with a synthetic impulse response.
4. Verify playback uses AudioBufferSourceNode connected to the correct lane.
5. Verify same-kind choke stops the previous source.
6. Verify render failure is contained (no throw, no game block).
7. Verify playback failure is contained.

### Integration

1. Verify SemanticPresentationLayer no longer uses createOscillator.
2. Verify CommanderRitualLayer no longer uses createOscillator.
3. Verify beat-snap (presentationSoundDelayMs) is still used for both layers.
4. Verify duck envelope (-4dB/40/360/320ms) is unchanged.
5. Verify AudioVisualProvider calls renderAllPatches after context creation.
6. Verify commander sound goes through CommanderBus, ordinary through EventBus.

### Heart animation

1. Verify ambient-heart-throb keyframes snap to beat grid (0%/25% for two beats).
2. Verify animation-delay still uses var(--transport-phase-delay, 0ms).

### Evidence

1. Run `npm run check`.
2. Verify review.av3 and review.av4 pins pass.
3. Check `git diff --check`.

## Output

Findings only, ordered by severity. For each finding:

- severity: BLOCKER / HIGH / MEDIUM / LOW
- exact file and line/section evidence
- violated contract statement
- smallest correction

End with one verdict: `SFX-QUALITY: SHIPPED-OK` or the highest finding severity.
Then `HUMAN GATES: PENDING`.

## Constraints

- No file edits.
- No git mutation.
- Findings only.
- Do not infer audio quality from metadata.
