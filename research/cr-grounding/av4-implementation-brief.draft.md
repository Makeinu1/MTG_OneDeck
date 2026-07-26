# AV4 implementer brief — commander cast ritual

Implement AV4 only against the frozen `docs/audio-visual-contract.md`.

Read only:

- `src/components/game/GameScreen.tsx`
- `src/components/game/gameController.tsx`
- `src/components/game/CommanderCutIn.tsx`
- commander-related sections of `src/components/game/game.css`
- `src/components/game/presentation/*`
- `src/store/gameStore.ts` only around `prepareCommanderResolution`, `resolveTop`, `commitCommanderResolution`
- `src/store/__tests__/commanderResolutionGate.test.ts`
- `src/components/game/HudInteractions.test.tsx` commander cut-in case
- `src/components/game/__tests__/review.av4-commander-ritual.test.ts`

Required:

1. Add `presentation/commanderRitual.ts` with:
   - `COMMANDER_RITUAL_DURATION_MS = 650`;
   - deterministic `commanderMotifSpec()` using Web Audio oscillator notes only;
   - pure `commanderDuckEnvelope(startSec, baseGain)` using `COMMANDER_MIX_TUNING`: -4dB, 40ms attack, 360ms hold, 320ms release.
2. Add `presentation/CommanderRitualLayer.tsx`, subscribed future-only to the browser-session `presentationRuntime`.
   - react only to `commander-cast`;
   - derive the cast face/card name/type/image from the already-committed current store state;
   - render `CommanderCutIn` immediately for exactly 650ms and replace/restart on recast;
   - play the fixed motif through CommanderBus only when event sounds are effectively audible;
   - duck MusicBus only when BGM is effectively audible;
   - schedule the exact envelope with Web Audio time;
   - cleanup motif nodes and cancel/restore duck safely on policy-off, unmount, or replacement;
   - no randomness, tax/count/mana scaling, generic sound, generic pulse, state wait, or pointer lock.
3. Expose MusicBus and CommanderBus accessors from `audioVisualSession.ts`.
4. Make `CommanderCutInData` live beside `CommanderCutIn`, remove `landed`, remove slash/explosion language, and use one restrained white-platinum halo. Keep card, name, and type. CSS duration source is `--dur-ritual` (650ms); reduced motion is fade/static only.
5. Remove the resolution-time cut-in/timers and `resolutionLocked` plumbing from controller/GameScreen. `CommanderRitualLayer` replaces it.
6. Keep the store compatibility fields/method names, but take the presentation gate out of all resolution paths. A commander resolves to its destination in the same store call, `pendingCommanderResolution` remains null, and resolve-all still has one-step undo. Update the ordinary gate test to assert immediate resolution.
7. Add ordinary tests for fixed motif/envelope, commander-only subscription, cleanup, repeated identical ritual, and immediate resolve/resolve-all behavior. Do not edit `review.*`, `docs/`, `AGENTS.md`, ledger, or git.

Run the AV4 judge test, AV3 judge tests, commander/store ordinary tests, lint, and build. Report changed files, exact results, defer, concerns.
