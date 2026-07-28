# M-AV contract revision cold-audit brief

## Claim under adversarial review

The 2026-07-26 M-AV contract revision is claimed to be decision-complete for implementation,
not implemented or shipped. Adversarially test that claim; do not confirm it by default.

## Read only

- `AGENTS.md`
- `docs/audio-visual-contract.md`
- `docs/design-vision.md` §2
- `docs/design-system.md` §7–§8a
- `docs/ui-architecture-v2.md` §7
- `docs/acceptance.md` M-AV
- `research/audio/bgm-loop-candidates/loop-metadata.json`
- `research/audio/bgm-loop-candidates/README.md`
- `research/cr-grounding/av-implementation-contract.draft.md`
- `src/components/game/__tests__/review.av0-contract.test.ts`
- `src/components/game/__tests__/review.d5-motion.test.ts`

## Checks

1. Find contradictions between the user-decided dark default-ON audio, light effective silence,
   first-gesture start, same-page position preservation, and every active document.
2. Verify candidate B identity, MP3 versus WAV hash distinction, duration, BPM, anchors,
   gain, crossfade, and public path are internally consistent.
3. Verify the four-event allowlist and commander-only exception remain intact.
4. Verify GameState cannot be made to wait for quantization or ritual by this contract.
5. Verify the review pins do not weaken prior evidence and are implementable without changing
   GameState, GameCommand, snapshot schema, dependencies, or protected governance.
6. Identify any still-open choice that would force an implementer to invent product behavior.
7. Run only read-only or test discovery commands; do not edit any file.

## Output

Findings only, ordered by severity. Each finding must be one of BLOCKER / HIGH / MEDIUM / LOW
and include exact file/section evidence plus the smallest correction. If no BLOCKER or HIGH
exists, end with `VERDICT: CONTRACT-FROZEN-OK`.

## Constraints

- No file edits.
- No git operations.
- Do not inspect unrelated source.
- Do not infer audio quality from metadata; human loop/comfort gates remain pending.
