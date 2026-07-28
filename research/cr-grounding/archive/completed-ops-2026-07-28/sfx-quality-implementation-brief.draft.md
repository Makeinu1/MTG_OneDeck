# SFX quality implementation brief — OfflineAudioContext multi-layer patches

## Role and objective

Implementer lane. Replace the current single-oscillator beeps with production-quality
multi-layer synthesized SFX rendered via OfflineAudioContext. Also fix the heart
animation to snap to the beat grid.

## Read

- `AGENTS.md`
- `docs/audio-visual-contract.md` §3, §3.1, §4, §5
- `src/components/game/__tests__/review.av3-semantic-runtime.test.ts` (read-only)
- `src/components/game/__tests__/review.av4-commander-ritual.test.ts` (read-only)
- `src/components/game/presentation/semanticSound.ts`
- `src/components/game/presentation/SemanticPresentationLayer.tsx`
- `src/components/game/presentation/CommanderRitualLayer.tsx`
- `src/components/game/presentation/commanderRitual.ts`
- `src/components/game/presentation/audioVisualSession.ts`
- `src/components/game/presentation/musicBus.ts` (bus structure only)
- `src/components/game/presentation/AudioVisualProvider.tsx`
- `src/components/game/game.css` (ambient-heart-throb keyframes only)

## Implement

### 1. New file: `src/components/game/presentation/sfxPatches.ts`

Pure data module. No DOM, no AudioContext, no side effects.

```ts
export interface SfxLayer {
  kind: 'osc' | 'noise';
  // osc
  wave?: OscillatorType;
  freqStart: number;
  freqEnd?: number;
  detuneCents?: number;
  // noise
  filterType?: BiquadFilterType;
  filterFreqStart?: number;
  filterFreqEnd?: number;
  filterQ?: number;
  // envelope
  attackMs: number;
  decayMs?: number;
  sustain?: number;
  releaseMs: number;
  gain: number;
  offsetMs: number;
}

export interface SfxPatch {
  id: string;
  durationMs: number;
  outputGainDb: number;
  layers: SfxLayer[];
  reverb?: { wetGain: number; decaySec: number };
}

export type SfxKind = 'spell-cast' | 'land-played' | 'turn-advanced' | 'commander-cast';

export const SFX_LEVELS_DB: Record<SfxKind, number> = {
  'spell-cast': -13,
  'land-played': -11,
  'turn-advanced': -15,
  'commander-cast': -8,
};

export function sfxPatch(kind: SfxKind): SfxPatch { ... }
```

Design the four patches per contract §3.1:

- **spell-cast** (~200ms): L1 sine 880→1320Hz sweep a=5/r=140ms; L2 sine 884Hz detuned
  shimmer a=5/r=160ms low gain; L3 bandpass noise 600→2400Hz a=8/r=90ms.
  Reverb wet=0.25 decay=0.7s.
- **land-played** (~200ms): L1 sine 120→60Hz pitch drop a=3/r=150ms; L2 triangle 240Hz
  a=3/r=90ms; L3 lowpass noise burst a=2/r=60ms. No reverb (dry = grounded).
- **turn-advanced** (~250ms): L1 highpass noise tick a=1/r=20ms; L2 sine 660Hz a=3/r=200ms;
  L3 sine 990Hz a=3/r=200ms lower gain. Reverb wet=0.15 decay=0.5s.
- **commander-cast** (≤650ms): Three-note motif G4(392)/B4(493.88)/D5(587.33) with
  offsets 0/120/260ms. Each note = sub(1oct down sine) + body(sine) + shimmer(1oct up sine,
  low gain). Add a low-frequency pad layer. Reverb wet=0.35 decay=0.9s.
  Total durationMs MUST be ≤ 650.

### 2. New file: `src/components/game/presentation/sfxRenderer.ts`

Module-level cache and render/playback helpers.

```ts
export function renderAllPatches(): Promise<void>;
export function playSfx(kind: SfxKind, lane: GainNode, ctx: AudioContext, delaySec: number): void;
export function isSfxReady(): boolean;
```

- `renderAllPatches()`: For each of the 4 patches, create an OfflineAudioContext
  (2ch, 48kHz, duration = patch.durationMs + reverb tail). Build oscillator/noise layers
  with ADSR envelopes. If reverb is specified, generate a synthetic impulse response
  (exponential decay noise buffer) and convolve. Apply outputGainDb. Cache the resulting
  AudioBuffers in a module-level Map. On any error, skip that patch (do not throw).
- `playSfx(kind, lane, ctx, delaySec)`: If buffer exists, create AudioBufferSourceNode,
  connect to lane, start at ctx.currentTime + delaySec. Choke: track the last source per
  kind; stop the previous one before starting a new one.
- `isSfxReady()`: true when at least one buffer is cached.
- No Math.random. Noise buffers use a deterministic PRNG seeded with a fixed constant.

### 3. Modify `SemanticPresentationLayer.tsx`

- Remove `scheduleVoice` and all `createOscillator` usage.
- Import `playSfx` from `sfxRenderer`.
- In the subscription callback, after the policy check, call
  `playSfx(event.kind, lane, ctx, delayMs / 1000)` for spell/land/turn only.
  Commander returns no patch from `sfxPatch` for the event lane (it is handled by
  CommanderRitualLayer via CommanderBus).
- Keep `presentationSoundDelayMs` for beat-snap.
- Keep all visual logic (spell pulse, land settle) unchanged.

### 4. Modify `CommanderRitualLayer.tsx`

- Remove `playMotif` oscillator construction.
- Import `playSfx` from `sfxRenderer`.
- Play the commander buffer through CommanderBus at the shared `audioStartAtSec`.
- Keep duck envelope logic, `shouldDuckMusic`, `presentationSoundDelayMs`, and
  `audioStartAtSec` unchanged.

### 5. Modify `semanticSound.ts`

- Remove `SemanticSoundSpec`, `SPELL_SPEC`, `LAND_SPEC`, `TURN_SPEC`, and
  `semanticSoundSpec()`.
- Keep `presentationSoundDelayMs` and its imports.

### 6. Modify `commanderRitual.ts`

- Remove `MotifNote`, `MOTIF_SPEC`, and `commanderMotifSpec()`.
- Keep `COMMANDER_RITUAL_DURATION_MS`, `DuckEnvelope`, `commanderDuckEnvelope`,
  and `shouldDuckMusic`.

### 7. Modify `AudioVisualProvider.tsx`

- After AudioContext creation and lane setup succeeds, call `renderAllPatches()`
  (fire-and-forget, catch errors silently).

### 8. Fix heart animation in `game.css`

Replace the `ambient-heart-throb` keyframes:

```css
@keyframes ambient-heart-throb {
  0%, 100% { transform: scale(1); }
  3%  { transform: scale(1.18); }
  9%  { transform: scale(1); }
  25% { transform: scale(1.13); }
  31% { transform: scale(1); }
}
```

### 9. Ordinary tests

Add `src/components/game/presentation/__tests__/sfxPatches.test.ts`:
- Determinism: sfxPatch(kind) deep-equals itself across calls
- Layer counts ≥ 2 for ordinary, ≥ 4 for commander
- Commander durationMs ≤ 650
- SFX_LEVELS_DB values match contract
- No Math.random in sfxPatches.ts or sfxRenderer.ts source text

Add `src/components/game/presentation/__tests__/sfxRenderer.test.ts`:
- renderAllPatches resolves without throwing (mock OfflineAudioContext if jsdom lacks it)
- playSfx with missing buffer does not throw
- isSfxReady is false before render, true after (with mock)

Update existing ordinary tests that reference removed exports
(`semanticSoundSpec`, `commanderMotifSpec`).

## Boundaries

- Do not edit `review.*`, `docs/`, `AGENTS.md`, ledger, or git state.
- Do not add npm dependencies or audio asset files.
- Do not change GameState, GameCommand, engine, store APIs, or snapshot schema.
- Do not change the beat-snap algorithm, duck envelope, or event projection logic.
- Do not change visual effects (spell pulse, land settle, turn cue, cut-in).
- Do not use Math.random anywhere in new code.

## Verify

- `npx vitest run src/components/game/__tests__/review.av3-semantic-runtime.test.ts src/components/game/__tests__/review.av4-commander-ritual.test.ts`
- New ordinary tests
- `npm run lint`
- `npx tsc -b`
- Report changed files, exact results, defer, and concerns.
