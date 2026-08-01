# AV7-P-SFX-AUDITION implementation brief

- **Milestone ID**: `AV7-P-SFX-AUDITION`
- **Base SHA**: `fdcac70bc8a9c4b6ab519163d04bf70fe4712e39`
- **Role**: implementer
- **Goal**: build a dev-only, responsive audition fixture that lets a human compare a fixed physical/magical SFX palette over the approved BGM using the track's native full-file loop.

## Constraints

- This is the prototype milestone only. Do not change production runtime under `src/`, public assets, `docs/`, the CR ledger, `AGENTS.md`, judge-owned `review.*` tests, git state, or `.claude/loop-state.md`.
- Preserve the user-owned `sound/` tree byte-for-byte. Do not rename, delete, or overwrite anything there and do not add the whole tree or its archives to the deliverable.
- The fixture lives at `research/design/mockups/av7-audio-palette.html`. It must work from the Vite dev server without a network dependency and must not become an application route or production build entry.
- Derived audition assets live under `research/audio/sfx-palette/`. Record source path, license/provenance, transform, SHA-256, duration, sample rate, bit depth, and measured peak in a machine-readable manifest.
- Kenney Casino Audio is locally proven CC0. The user-supplied summon files are prototype-only pending publication confirmation. Do not use or copy Cockatrice or `sound/spells/` assets.
- Use only processed 48 kHz, 16-bit PCM WAV files in the three main palettes. Trim leading/trailing silence conservatively, apply 2 ms edge fades, and master each file to true peak no higher than -3 dBFS.
- Normal cues must be at most 1.0 s. The short commander cue must be at most 1.6 s. The 9.56 s invocation may be exposed only as a clearly labelled comparison outside the three main palettes.
- The approved BGM must stream from `public/audio/bgm/candidate-b-tight-128-bars.mp3` through one media element with native `loop=true`. Do not implement a second deck, manual loop handoff, crossfade, or full-track AudioBuffer decode.
- Defaults are BGM 70 and SFX 80. The fixture is a design tool; do not write application preferences or localStorage.
- No random variation, chain/history escalation, card-strength mapping, raw click sounds, or stateful scoring.

## Fixture behavior

1. Provide the three palette presets `tabletop` (卓上音のみ), `hybrid` (卓上＋魔法, initial selection), and `arcane` (魔法強め).
2. Provide individually playable semantic rows for draw, land, spell cast, tap, untap, stack resolution, shuffle, turn advance, and commander cast.
3. Candidate sources:
   - draw: Kenney `card-slide` and `card-fan`;
   - land: Kenney `card-place` plus a dry Web Audio low thud;
   - spell: Kenney `card-place` plus `sound/召喚.ogg`;
   - tap/untap: Kenney `card-shove` / `card-slide`;
   - resolve: a short Kenney `card-shove`;
   - shuffle: Kenney `card-shuffle`, trimmed to at most 0.9 s;
   - turn: Kenney `chip-lay` versus the dry low thud;
   - commander: low contact plus `sound/統率者召喚.mp3`, with fixture-only BGM ducking.
4. Each row exposes its fixed layer names and gains. The three palettes switch those fixed layer sets; they do not randomize.
5. Include BGM/SFX sliders, BGM play/pause, per-cue play, a deterministic continuous-demo sequence, stop-all, AudioContext/status readout, track position/loop-count readout, and an export/download of the current palette/gains as JSON.
6. Audio starts only from an explicit fixture control. State/UI must never await cue completion. Same-row replay stops the preceding tail before starting the new attack.
7. Commander is the only cue that ducks BGM. Stopping, changing palette, or replaying must restore the BGM gain safely.
8. Use Japanese UI text, visible focus, at least 44 px controls, and `data-testid` on the fixture root, transport controls, palette controls, event buttons, sliders, continuous demo, stop-all, status, and export.
9. Fit and remain usable at 375x812, 812x375, and 1440x900 without horizontal page overflow.

## Deliverables

- `research/design/mockups/av7-audio-palette.html`
- `research/audio/sfx-palette/README.md`
- `research/audio/sfx-palette/manifest.json`
- reproducible asset-rendering script under `research/audio/sfx-palette/`
- only the derived preview assets referenced by the manifest
- update `research/design/mockups/README.md` with the dev-server URL and explicit prototype-only status

## Done when

- The judge-owned `review.av7p-audition-fixture.test.ts` passes without modification.
- The render script can regenerate the manifest-listed WAVs from the untouched `sound/` sources.
- The fixture has no direct references to Cockatrice, `sound/spells/`, zip/7z archives, or remote resources.
- Targeted ordinary checks pass.
- Report changed files, render/targeted-test evidence, deferred production work, and any perceptual decisions still awaiting the human gate.
