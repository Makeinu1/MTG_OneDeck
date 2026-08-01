# AV7-P2-SPELL-COMMANDER-REFINE cold audit findings

- **Auditor**: `/root/av7p2_cold_auditor` (`gpt-5.6-sol`, context-free)
- **Frozen fingerprint**:
  `dd76afd4b45745d0ec31722f0dc85e256cec8d1f60f6fc95c33521a6094f1aef`
- **Result**: `AUDIT-OK-PENDING-FULL-CHECK`
- **Findings**: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0

## Independent evidence

- Recomputed candidate fingerprint matched before and after audit.
- Focused judge suite passed: 2 files / 11 tests.
- Isolated renderer rerun left all 15 WAV files and `manifest.json`
  byte-identical.
- Non-target preview aggregate remained
  `3018b1f24b2a84ff0ade40bd672174e3e4190e4183743ef401df5d7690dbd699`;
  user-owned `sound/` aggregate remained
  `b6f6a2a7869fdb2911034586101b78f72e6cd2638bab925bf48ec1d34820be93`.
- Independent PCM parsing confirmed stereo 48 kHz/16-bit PCM. Spell measured
  0.48 s, RMS -27.33 dBFS, true peak -7.63 dBFS; commander measured 1.24 s,
  RMS -27.78 dBFS, true peak -7.96 dBFS.
- Sample/envelope inspection confirmed zero-valued boundaries, 2 ms fades,
  immediate attacks, overall exponential decay, no delayed repeat, and low
  frequency energy about 19-22 dB below total.
- Fixed seeds, dependency-free generation, palette matrices, comparison-only
  provenance, fixture paths, choke/stop/rejection handling, commander-only
  ducking, and scope boundaries were independently traced.
- A separate browser session exercised BGM, spell and commander replay, all
  palettes, continuous demo, and stop-all. At 1440x900, 375x812, and 812x375,
  horizontal overflow was zero, controls were at least 44 px, and console
  warnings/errors were zero.
- No tracked product, `public/`, dependency, or `docs/` change existed relative
  to the base SHA.

## Limitations

- Subjective human listening remains a human gate.
- Failure branches were source-traced but network/media rejection was not
  fault-injected, and live closure-scoped AudioParam values were not externally
  observable.

## Post-audit full gate

- The candidate fingerprint still matched
  `dd76afd4b45745d0ec31722f0dc85e256cec8d1f60f6fc95c33521a6094f1aef`
  immediately before the single final full check.
- `npm run check`: PASS. Lint completed with zero errors and one pre-existing
  hook-dependency warning outside this prototype; core passed 100 files / 1048
  tests; DOM passed 211 files / 1509 tests; TypeScript build and Vite production
  build passed.
