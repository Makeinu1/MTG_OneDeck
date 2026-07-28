# SFX v2 implementation brief — volume sliders, louder SFX, commander redesign

## Role and objective

Implementer lane. Three changes in one slice:
1. Add BGM and SFX volume sliders to the settings menu.
2. Raise SFX default levels (already pinned in review tests).
3. Redesign commander-cast patch with rich timbres (sawtooth/triangle + filters).
4. Make the renderer apply filters to osc layers (not just noise).

## Read

- `AGENTS.md`
- `docs/audio-visual-contract.md` §3.1 (updated 2026-07-26)
- `src/components/game/__tests__/review.av3-semantic-runtime.test.ts` (read-only)
- `src/components/game/__tests__/review.av4-commander-ritual.test.ts` (read-only)
- `src/components/game/presentation/sfxPatches.ts`
- `src/components/game/presentation/sfxRenderer.ts`
- `src/components/game/presentation/audioVisualPreferences.ts`
- `src/components/game/presentation/AudioVisualProvider.tsx`
- `src/components/game/presentation/musicBus.ts`
- `src/components/game/ThumbZone.tsx`
- `src/components/game/game.css` (menu section)

## Implement

### 1. Volume sliders in preferences (audioVisualPreferences.ts)

Extend `AudioPreferences`:

```ts
export interface AudioPreferences {
  bgmEnabled: boolean;
  eventSoundsEnabled: boolean;
  bgmVolume: number;   // 0-100, default 70
  sfxVolume: number;   // 0-100, default 80
}
```

- `loadAudioPreferences()`: parse `bgmVolume`/`sfxVolume` from stored JSON.
  If missing or invalid, default to 70/80. Existing stored prefs without volume
  fields must not break (backward compat).
- `saveAudioPreferences()`: serialize all four fields.
- Add `getEffectiveGains(preferences, flags)` returning
  `{ musicGain: number; sfxGain: number }` where each is 0 when not audible,
  otherwise `(volume / 100)`.

### 2. Wire volume into buses (AudioVisualProvider.tsx / musicBus.ts)

- When policy changes, set `music.gain.value = BGM_GAIN_DB_linear * (bgmVolume / 100)`
  instead of just `BGM_GAIN_DB_linear` or 0.
- Add a module-level SFX master gain node (or use the existing events lane gain)
  scaled by `sfxVolume / 100`. Commander lane also scaled by `sfxVolume / 100`.
- Volume changes apply immediately (no re-render of patches needed; patches are
  rendered at full level and the bus gain scales output).

### 3. Volume sliders in ThumbZone.tsx

After each ON/OFF button (BGM, ゲーム進行音), add an `<input type="range">`:

```tsx
<input
  type="range"
  min={0}
  max={100}
  value={preferences.bgmVolume}
  data-testid="menu-bgm-volume"
  onChange={(e) => {
    const next = { ...preferences, bgmVolume: Number(e.target.value) };
    setPreferences(next);
    saveAudioPreferences(next);
  }}
/>
```

Same for SFX volume with `data-testid="menu-sfx-volume"`.

- Sliders are visible and operable in both themes (light theme hint stays on buttons).
- Keep the existing button order: theme → BGM button → BGM slider → event button →
  event slider → ambient button.
- Style: `width: 100%; accent-color: var(--gold-bright);` in game.css under the
  menu section. Height compact so all items still fit in first viewport at 375×812.

### 4. Raise SFX_LEVELS_DB (sfxPatches.ts)

Change the constant to match the already-updated review pins:

```ts
export const SFX_LEVELS_DB: Record<SfxKind, number> = {
  'spell-cast': -8,
  'land-played': -6,
  'turn-advanced': -10,
  'commander-cast': -3,
};
```

### 5. Redesign commander-cast patch (sfxPatches.ts)

Replace the all-sine COMMANDER_CAST with rich timbres. Keep G4/B4/D5 pitches,
offsets 0/120/260ms, and durationMs ≤ 650. New design:

- Each note: sub (sine, 1oct down) + body (**sawtooth** through lowpass sweep
  800→2000Hz) + shimmer (**triangle**, 1oct up, low gain)
- Low pad: **sawtooth** G2 (98Hz) through lowpass 400Hz, long release
- Noise riser: bandpass noise 1000→4000Hz sweep over 0–300ms, low gain
- Reverb: wet 0.4, decay 1.0s (widest of all patches)
- Total layers: ≥ 12

### 6. Renderer: apply filters to osc layers (sfxRenderer.ts)

In `scheduleLayer`, when `layer.kind === 'osc'` AND `layer.filterType` is defined,
insert a BiquadFilterNode between the oscillator and the envelope gain:

```ts
osc.connect(filter);
filter.connect(env);
```

Instead of the current direct `osc.connect(env)`. Support `filterFreqStart`,
`filterFreqEnd` (linear ramp), and `filterQ`. When no filterType is set on an osc
layer, keep the direct connection.

### 7. Ordinary tests

Update `src/components/game/presentation/__tests__/sfxPatches.test.ts`:
- SFX_LEVELS_DB values match new pins
- Commander patch has ≥ 12 layers
- Commander patch has at least one sawtooth layer
- Commander patch has at least one noise layer (riser)

Update `src/components/game/presentation/__tests__/sfxRenderer.test.ts` if needed
for the osc-filter path.

Add volume preference tests in the existing ordinary test file or a new one:
- Default volumes are 70/80
- Stored prefs without volume fields parse with defaults
- getEffectiveGains returns 0 when not audible
- getEffectiveGains returns volume/100 when audible

## Boundaries

- Do not edit `review.*`, `docs/`, `AGENTS.md`, ledger, or git state.
- Do not add npm dependencies or audio asset files.
- Do not change GameState, GameCommand, engine, store APIs, or snapshot schema.
- Do not change beat-snap, duck envelope, event projection, or visual effects.
- Do not use Math.random anywhere.

## Verify

- `npx vitest run src/components/game/__tests__/review.av3-semantic-runtime.test.ts src/components/game/__tests__/review.av4-commander-ritual.test.ts`
- New/updated ordinary tests
- `npm run lint`
- `npx tsc -b`
- Report changed files, exact results, defer, and concerns.
