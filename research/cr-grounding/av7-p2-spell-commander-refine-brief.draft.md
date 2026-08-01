# AV7-P2-SPELL-COMMANDER-REFINE implementation brief

- **Milestone ID**: `AV7-P2-SPELL-COMMANDER-REFINE`
- **Base SHA**: `fdcac70bc8a9c4b6ab519163d04bf70fe4712e39`
- **Parent AV7-P release fingerprint**:
  `ae130c3d70516bb17d4ccef1ce19ac1ab1ba30eb7850eb9fab893d584c983455`
- **Role**: implementer
- **Goal**: replace only the spell-cast and commander-cast magical layers with
  deterministic, project-original sounds that sit inside the approved BGM and
  physical card language instead of dominating them.

## Judge decision

Do not search for or download another sample pack. Generate the two magical
layers locally. This avoids unresolved publication rights and makes duration,
density, envelope, and repeatability controllable. The existing voice/chant
files are rejected from the recommended palette.

Current measured mismatch:

- `spell-place.wav`: RMS about -34.5 dBFS, 0.46 s;
- `spell-summon.wav`: RMS about -15.5 dBFS, 0.94 s;
- `commander-contact.wav`: RMS about -30.8 dBFS, 0.60 s;
- `commander-short.wav`: RMS about -17.8 dBFS, 1.54 s.

The old magical layers therefore remain roughly 14-17 dB in front of their
physical companions after the current hybrid gains. This density, not merely
peak level, is the defect to correct.

## Sound contract

### Spell: `spell-arcane-snap.wav`

- Duration: 0.42-0.55 s.
- Raw PCM RMS: -30 to -25 dBFS; measured true peak no higher than -6 dBFS.
- One immediate attack, then one decay. No delayed second hit, voice, chant,
  recognizable melody, bass drop, or rhythm-game timing.
- Timbre: dry air/spark transient plus inharmonic upper-mid resonances. Keep
  low-frequency energy out so the BGM kick and land thud remain readable.
- Meaning: the physical card has landed and a small amount of magic has fired.

### Commander: `commander-portal-open.wav`

- Duration: 1.15-1.35 s.
- Raw PCM RMS: -28 to -23 dBFS; measured true peak no higher than -6 dBFS.
- One short opening/impact followed by an airy, inharmonic tail. No spoken
  phrase, chant, fanfare melody, repeated rhythmic hits, or 9.56 s invocation.
- The existing physical contact, dry low thud, cut-in, and BGM duck remain the
  ritual. The new layer adds space and scale without replacing that contact.

Both files must be deterministic stereo 48 kHz/16-bit PCM WAV with at least
2 ms edge fades. Use a fixed seeded noise source and bounded synthesis; never
use `Math.random()`. Record provenance as `project-original` and point the
manifest source at the checked-in synthesis function.

## Frozen palette values

- `tabletop` remains unchanged:
  - spell: `spell-place` 0.80;
  - commander: `commander-contact` 0.55 + thud 0.50.
- `hybrid` (recommended/default):
  - spell: `spell-place` 0.72 + `spell-arcane-snap` 0.30;
  - commander: `commander-contact` 0.44 + thud 0.50 +
    `commander-portal-open` 0.46.
- `arcane`:
  - spell: `spell-place` 0.52 + `spell-arcane-snap` 0.56;
  - commander: `commander-contact` 0.32 + thud 0.42 +
    `commander-portal-open` 0.68.

Every draw, land, tap, untap, resolve, shuffle, and turn layer/gain remains
byte-for-byte identical in the fixture. Normal spell cast does not duck BGM;
commander remains the only ducked cue.

## Implementation boundaries

- Work only in the existing AV7-P development fixture and
  `research/audio/sfx-palette/` renderer/assets. Do not change production
  runtime, `public/`, `docs/`, GameState, GameCommand, dependencies, ledger,
  git state, or judge-owned `review.*` tests.
- Preserve `sound/` byte-for-byte. The user-supplied spell/commander/long
  invocation sources may remain in the generated manifest only as
  `comparisonOnly: true`; they must not occur in fixture palettes, the fixture
  source map, or a playable comparison control.
- Remove the long-invocation comparison panel and handler from the recommended
  audition screen. Add a short visible decision note that voice/long invocation
  candidates were rejected and that the two magical layers are project-made.
- Preserve the single native-loop BGM element, defaults 70/80, three palettes,
  exactly-once/choke behavior, deterministic continuous demo, commander-only
  duck, responsive layout, and all accessibility controls.
- Extend the renderer reproducibly without adding packages. It is acceptable to
  add one focused synthesis module beside `render-previews.mjs`.

## Deliverables

- deterministic synthesis source;
- `spell-arcane-snap.wav` and `commander-portal-open.wav`;
- updated renderer, manifest, preview README, and audition fixture;
- no other cue redesign and no external download.

## Done when

- the two judge-owned AV7-P/AV7-P2 review files pass unchanged;
- renderer reruns produce byte-identical WAVs and manifest;
- measured duration, PCM format, true peak, and RMS meet the ranges above;
- old voice/chant assets are absent from all playable fixture paths;
- `sound/` aggregate hash remains
  `b6f6a2a7869fdb2911034586101b78f72e6cd2638bab925bf48ec1d34820be93`;
- report changed files, targeted evidence, and any honest limitation.
