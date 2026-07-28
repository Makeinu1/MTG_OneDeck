# SFX v3 cold-audit brief — unified thud language, BPM-rhythm commander

## Claim under adversarial review

The 2026-07-26 SFX v3 change is claimed to unify all four SFX patches into
a single "physical thud" language (sine pitch-drop + triangle body + noise
transient, all dry/no reverb), with commander-cast using three thuds spaced
at 122 BPM 8th-note intervals (0/246/492ms). It is `implemented-not-audited`.
Adversarially test the claim.

## Required reading

- `AGENTS.md`
- `docs/audio-visual-contract.md` §3.1
- `src/components/game/presentation/sfxPatches.ts`
- `src/components/game/presentation/sfxRenderer.ts`
- `src/components/game/__tests__/review.av3-semantic-runtime.test.ts`
- `src/components/game/__tests__/review.av4-commander-ritual.test.ts`
- `src/components/game/presentation/__tests__/sfxPatches.test.ts`

## Adversarial checks

1. Verify all four patches use the same timbral family: sine pitch-drop sub +
   triangle body + noise transient. No melodic oscillators (no fixed-pitch
   sine/triangle/sawtooth without pitch drop as the primary voice).
2. Verify no patch has reverb (all dry).
3. Verify commander-cast has exactly 3 hit groups at offsets 0/246/492ms.
4. Verify commander durationMs <= 650.
5. Verify SFX_LEVELS_DB = -8/-6/-10/-3.
6. Verify land-played is unchanged from the user-approved version
   (sine 120→60Hz + triangle 240Hz + lowpass noise 800Hz).
7. Verify spell-cast and turn-advanced are thud variants (pitch-drop + noise),
   not melodic.
8. Verify no Math.random in sfxPatches.ts or sfxRenderer.ts.
9. Run `npm run check`.
10. Check `git diff --check`.

## Output

Findings only, ordered by severity. End with:
`SFX-V3: SHIPPED-OK` or the highest finding severity.
Then `HUMAN GATES: PENDING`.

## Constraints

- No file edits. No git mutation. Findings only.
