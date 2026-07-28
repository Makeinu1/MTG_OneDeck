# AV2 correction brief — final implementer retry

This is AV2 implementer retry 2 and must be surgical. Read only the current AV2
production files, ordinary AV2-adjacent tests, and
`src/components/game/__tests__/review.av2-runtime-settings.test.ts`. Do not use git
or modify review/docs/AGENTS/ledger/controller/event-effect code.

Correct all of these:

1. Add `getTransportCssTiming(currentSec, manifest)` to the transport module. Derive
   beat duration and negative phase delay from the enclosing sparse-anchor span,
   normalize across full-track loops, and use it in the provider. Never write a
   fixed `0ms` phase.
2. Remove the empty CSS custom-property declarations. Apply the transport phase
   delay to core, inverse vignette, stack/status breath, and four-beat two-hit heart.
   Keep 700ms only as the fallback.
3. Make loop handoff single-flight (`crossfadeInProgress`). A timer and timeupdate
   must not start two crossfades. Track/cancel both handoff scheduling and completion
   work on pause/dispose. Ignore inactive element timeupdates.
4. Make `MusicRuntime.resume()` idempotent and return `Promise<boolean>` so media
   `play()` rejection reaches provider status. Do not claim playing before success.
5. Preserve gesture unlock and the reusable audio runtime for the browser page
   session across GameScreen unmount/remount. On unmount pause and remember position;
   do not require another gesture on route return and do not create duplicate media.
   Dispose the page-session runtime only on page teardown.
6. Keep live theme and ambient subscriptions. Light/game-exit pauses all audio
   without changing preferences; dark game return resumes remembered position.
7. Remove the now-unused combat/heat tokens from `src/ui/tokens.css`.
8. Add ordinary tests for anchor-derived timing, repeated resume, single-flight
   handoff, play rejection, and session remount state where practical.

Run the updated AV2 judge pin, AV0/AV1 pins/tests, relevant ordinary UI tests, lint,
and build. Report changed files, exact results, defer, and concerns only.
