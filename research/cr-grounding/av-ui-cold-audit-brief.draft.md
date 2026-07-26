# M-AV UI implementation cold-audit brief

## Claim under adversarial review

The 2026-07-26 M-AV implementation is claimed to satisfy the frozen
`docs/audio-visual-contract.md` through slices AV0–AV4. It is
`implemented-not-audited`, not published or shipped. Adversarially test the claim;
do not confirm it by default.

Human listening and comfort gates H1–H7 remain outside this audit. Do not infer
audible loop quality, comfort, or aesthetic success from passing code or metadata.

## Required reading

- `AGENTS.md`
- `docs/audio-visual-contract.md`
- `docs/design-vision.md` §2
- `docs/acceptance.md` M-AV
- `research/audio/bgm-loop-candidates/loop-metadata.json`
- `src/components/game/presentation/`
- `src/components/game/AmbientBackdrop.tsx`
- `src/components/game/CommanderCutIn.tsx`
- `src/components/game/GameScreen.tsx`
- `src/components/game/gameController.tsx`
- `src/components/game/ThumbZone.tsx`
- `src/components/game/game.css`
- `src/store/gameStore.ts` only where commander resolution is handled
- every `src/components/game/__tests__/review.av*.test.ts`
- `src/store/__tests__/commanderResolutionGate.test.ts`

Inspect additional files only when a reference or failing test requires it.

## Adversarial checks

### AV0 — approved asset and transport

1. Verify the public MP3 exists and has SHA-256
   `6307839cab73c84265023ce2a8cdb489355f3f48a3ef9c94d8cdb6b6190dde0c`.
2. Verify manifest identity, `122.000736` BPM, `251.798458` seconds,
   512 beats / 128 bars, `-4.5dB`, sparse anchors, full-track boundaries,
   and MP3-versus-WAV hash distinction.
3. Attack the two-stream, non-native-loop, 40ms equal-power boundary for gaps,
   duplicate scheduling, accidental short-loop reconstruction, or full-file
   `AudioBuffer` decoding.
4. Verify Music/Event/Commander/Master bus separation, lifecycle cleanup, and
   first-gesture unlock failure handling.

### AV1 — semantic event boundary and exactly-once

1. Prove the public event union has exactly four kinds:
   `spell-cast`, `commander-cast`, `land-played`, `turn-advanced`.
2. Trace all normal and forced cast, land play, and real turn-advance success
   paths. Find any successful path that omits an event or any failed/cancelled
   path that emits one.
3. Attack rerender, Strict Mode, remount, reload baseline, undo, redo, and
   snapshot restore for replay or duplicate emission.
4. Verify IDs are browser-session monotonic IDs and no timestamp/card/log-text
   heuristic is used as the deduplication key.
5. Search for remaining log-regex chain inference, input-triggered audio, or
   event generation for draw, resolve, trigger, token, mana, tap, life, counter,
   phase, undo, redo, restore, reload, gesture, or settings changes.

### AV2 — effective policy, settings, and ambient clock

1. Verify sound is effective only on the dark game screen after explicit
   gesture, while saved preferences survive light mode and route changes.
2. Verify BGM defaults ON independently and legacy sound preference migrates
   only to event sounds; verify no slider, track picker, player, or new HUD mute.
3. Verify BGM OFF with ambient motion ON retains an inaudible transport, and the
   700ms clock is used only when manifest/Transport is unavailable.
4. Verify transport drives only the restrained core/vignette/bands/two-beat
   heartbeat, while stars/gas/aurora/meteors remain slow and independent.
5. Verify ambient OFF and reduced motion stop continuous movement/scaling
   without changing audio preferences.
6. Verify at 375×812 that theme, BGM, game sounds, and ambient motion are in the
   first menu viewport, and that the modal sheet stacks above the hand-zone rail.
7. Search for the removed 525ms combat clock, heat/fire/full-screen flashes, FFT,
   runtime volume analysis, or all-background beat binding.

### AV3 — ordinary semantic feedback

1. Verify spell cast, land played, and turn advanced each have one fixed,
   bounded sound and one fixed, restrained visual response.
2. Verify commander cast suppresses the generic cast sound and pulse.
3. Attack simultaneous and repeated events for additive gain, particle count,
   randomization, chain/history/card-strength scaling, or unbounded DOM/state.
4. Verify source-to-stack causality starts immediately and quantization affects
   event sound only, with a 60ms snap window and no path above 80ms.
5. Verify the old celebration/sound modules and draw/resolve/tap/mana/life
   semantic audio paths are absent rather than merely hidden.

### AV4 — commander ritual

1. Verify commander cast commits to stack immediately and the 650ms ritual
   cannot delay GameState, stack rendering, resolve, or input.
2. Verify the old 780ms pending gate is unreachable in UI and store resolution
   paths while compatibility API names remain safe.
3. Verify motif notes and white-platinum cut-in are deterministic across
   recasts, taxes, source-coordinate absence, mana, and board state.
4. Verify motif and duck share one snapped audio start, generic cast feedback is
   excluded, and duck is exactly -4dB / 40ms attack / 360ms hold / 320ms release.
5. Verify BGM ducks only when both event sound and music are effectively audible,
   and cleanup or policy changes cancel nodes and restore gain safely.
6. Verify reduced motion is fade/static only and no landed/explosion/slash or
   competitive reward language/visual remains.

### Evidence and regressions

1. Run `npm run check`.
2. Confirm all AV `review.*` evidence actually reaches the production path and
   does not merely test an unused helper.
3. Check `git diff --check`.
4. Treat the Vite chunk-size notice as informational unless this change caused a
   material new regression.
5. Do not treat implementer reports or prior green output as evidence.

## Output

Findings only, ordered by severity. For each finding include:

- severity: BLOCKER / HIGH / MEDIUM / LOW
- affected slice(s): AV0 / AV1 / AV2 / AV3 / AV4
- exact file and line/section evidence
- violated contract statement
- smallest correction and the evidence needed after correction

Then give exactly one verdict for each slice:

- `AV0: SHIPPED-OK` or its highest finding severity
- `AV1: SHIPPED-OK` or its highest finding severity
- `AV2: SHIPPED-OK` or its highest finding severity
- `AV3: SHIPPED-OK` or its highest finding severity
- `AV4: SHIPPED-OK` or its highest finding severity

End with `HUMAN GATES: PENDING`. `SHIPPED-OK` is an audit verdict only; do not
publish, commit, alter a ledger status, or claim H1–H7 passed.

## Constraints

- No file edits.
- No git mutation.
- Findings only.
- No implementation history or rationale is available; judge only the frozen
  contract, repository state, executable evidence, and observed boundaries.
