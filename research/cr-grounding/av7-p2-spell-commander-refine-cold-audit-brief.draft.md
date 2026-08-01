# AV7-P2-SPELL-COMMANDER-REFINE cold-audit brief

Status claim under audit: `implemented-not-audited`.

- **Milestone ID**: `AV7-P2-SPELL-COMMANDER-REFINE`
- **Base SHA**: `fdcac70bc8a9c4b6ab519163d04bf70fe4712e39`
- **Frozen candidate fingerprint**:
  `dd76afd4b45745d0ec31722f0dc85e256cec8d1f60f6fc95c33521a6094f1aef`

Audit the current uncommitted candidate adversarially. Do not assume the audio,
renderer, fixture, manifest, judge tests, or browser evidence is correct.

## Candidate scope

- `research/audio/sfx-palette/`
- `research/design/mockups/av7-audio-palette.html`
- `research/design/mockups/README.md`
- `research/cr-grounding/av7-p2-spell-commander-refine-brief.draft.md`
- `src/components/game/__tests__/review.av7p-audition-fixture.test.ts`
- `src/components/game/__tests__/review.av7p2-spell-commander-refine.test.ts`

The fingerprint is SHA-256 over the sorted text of
`<per-file SHA-256><two spaces><path><newline>` for every file above. Exclude
this cold-audit brief and `.claude/loop-state.md`.

Product runtime, `public/`, `docs/`, dependencies, GameState, GameCommand, and
the CR ledger are outside scope and must be unchanged. `sound/` is user-owned
source material and is excluded from the candidate.

## Evidence claimed by the judge

- Both judge review files pass: 2 files / 11 tests.
- Renderer rerun leaves every preview and `manifest.json` byte-identical.
- `spell-arcane-snap.wav`: 0.48 s, stereo 48 kHz/16-bit PCM,
  true peak -7.63 dBFS in the manifest and raw RMS -27.33 dBFS.
- `commander-portal-open.wav`: 1.24 s, stereo 48 kHz/16-bit PCM,
  true peak -7.96 dBFS and raw RMS -27.78 dBFS.
- The non-target preview aggregate remains
  `3018b1f24b2a84ff0ade40bd672174e3e4190e4183743ef401df5d7690dbd699`.
- The user-owned `sound/` aggregate remains
  `b6f6a2a7869fdb2911034586101b78f72e6cd2638bab925bf48ec1d34820be93`.
- One Chromium session at 1440x900, 375x812, and 812x375 reported no
  horizontal document overflow, all nine cue buttons at least 44 px high,
  usable responsive layouts, successful BGM/spell/commander/replay/stop paths,
  and zero warning/error console entries.
- Full `npm run check` has intentionally not run after this candidate freeze.

## Required audit procedure

1. Read `AGENTS.md`, this brief, and every candidate file. Do not edit files
   and do not run state-changing git operations.
2. Recompute the candidate fingerprint exactly and stop if it has drifted.
3. Run the two focused judge review files and any additional non-mutating audio
   checks needed. Do not run full `npm run check`.
4. Audit both synthesis functions sample-by-sample in structure: fixed seed,
   no `Math.random`, no dependency or network input, one immediate attack and
   monotonic overall decay, at least 2 ms edge fades, no delayed repeat,
   chant, melody, bass drop, or rhythmic sequence.
5. Independently parse the WAV files and verify stereo 48 kHz/16-bit PCM,
   durations, raw RMS bounds, sample/true-peak bounds, manifest hashes, and
   deterministic regeneration. Check low-frequency masking risk and waveform
   discontinuities rather than trusting metadata alone.
6. Confirm the tabletop, hybrid, and arcane layer/gain matrices exactly match
   the acceptance brief. Every non-target cue must remain frozen, spell must
   never duck BGM, and commander must remain the only ducked cue.
7. Trace every playable fixture path. The old voice/short/long invocation
   assets must be `comparisonOnly` provenance records only and must not occur
   in a palette, source map, handler, or playable control.
8. Challenge same-row choke, rejection containment, stop-all, palette change,
   deterministic continuous demo, native BGM loop, commander duck restoration,
   control accessibility, and responsive CSS. Treat browser results above as
   claims, not authority.
9. Confirm no external download, dependency, product/public change, raw
   `sound/` URL, Cockatrice asset, or `sound/spells/` asset entered the fixture.

## Output

Return findings only, ordered BLOCKER/HIGH/MEDIUM/LOW. Every finding must name
an exact file and line, a reproducible check, and acceptance impact. Then list
independent checks run and limitations. If no finding exists, say so explicitly
and return `AUDIT-OK-PENDING-FULL-CHECK`. Do not modify any file.
