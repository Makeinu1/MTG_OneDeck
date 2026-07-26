# M-AV AV0 implementation brief

## Role and objective

Implementer lane. Implement only the frozen candidate-B asset, manifest, tuning,
preference boundary, and pure transport-grid primitives required by AV0.

## Read

- `AGENTS.md`
- `docs/audio-visual-contract.md` §4–§7
- `docs/ui-architecture-v2.md` §7.1, §7.4, §7.6
- `docs/acceptance.md` M-AV3 AV-17/19/21/34/35
- `src/components/game/__tests__/review.av0-contract.test.ts` (read-only)
- `src/components/game/__tests__/review.d5-motion.test.ts` (read-only)
- `src/components/game/motion.ts`
- `research/audio/bgm-loop-candidates/previews/candidate-b-tight-128-bars.mp3`

## Implement

1. Copy the exact approved MP3 to
   `public/audio/bgm/candidate-b-tight-128-bars.mp3` without transcoding.
2. Under `src/components/game/presentation/`, add:
   - `trackManifest.ts` exporting `TrackManifest` and `DARK_GAME_TRACK`.
   - `presentationTuning.ts` exporting the exact frozen tuning constants.
   - `audioVisualPreferences.ts` exporting the API imported by
     `review.av0-contract.test.ts`.
   - `audioVisualTransport.ts` exporting manifest validation and
     `getNextGridDelayMs`.
3. The grid helper must interpolate all
   `beatSpan * quantizeStepsPerBeat` steps, wrap at the full loop, return the next
   grid delay in milliseconds only inside the snap window, and return 0 for
   immediate playback otherwise.
4. New users default Music and musical-event preferences ON. Preserve and migrate an
   explicitly stored legacy `mtg-onedeck:sound-enabled` value to musical-event only.
   A new stored preference takes precedence over the legacy key.
5. Update the legacy `motion.ts` sound getter and comments to the frozen default-ON
   contract without changing its key or public functions.
6. Add ordinary tests for invalid manifests, loop wrapping, storage parse failure,
   private-mode storage failure, and effective light/non-game/pre-gesture silence.

## Boundaries

- Do not edit `docs/`, `review.*`, AGENTS, ledger, git, package manifests, engine,
  GameState, GameCommand, snapshot schema, store API, or existing user-owned
  research files.
- Do not implement media playback, React provider, presentation events, visuals,
  or commander behavior yet.
- Do not add dependencies.
- Do not transcode, normalize, or otherwise alter the MP3.

## Verify

- `sha256sum public/audio/bgm/candidate-b-tight-128-bars.mp3`
- targeted ordinary tests for the new modules
- `npx vitest run src/components/game/__tests__/review.av0-contract.test.ts src/components/game/__tests__/review.d5-motion.test.ts`
- `npm run lint`
- Report changed files, exact results, defer, and concerns. Do not claim overall M-AV
  completion.
