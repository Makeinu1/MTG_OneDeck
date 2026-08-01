# AV7-P-SFX-AUDITION cold-audit brief

Status claim under audit: `implemented-not-audited`.

- **Milestone ID**: `AV7-P-SFX-AUDITION`
- **Base SHA**: `fdcac70bc8a9c4b6ab519163d04bf70fe4712e39`
- **Frozen candidate fingerprint**: `1135e8563e893e568e6d608b7a1dfefc5e63b3a938b38973ab431801fa1cb612`
- **Acceptance brief**: `research/cr-grounding/av7-p-sfx-audition-brief.draft.md`

Audit the current uncommitted candidate adversarially. Do not assume the fixture,
manifest, renderer, judge test, or claimed browser evidence is correct.

## Candidate scope

- `research/design/mockups/av7-audio-palette.html`
- `research/design/mockups/README.md`
- `research/audio/sfx-palette/`
- `src/components/game/__tests__/review.av7p-audition-fixture.test.ts`

The implementation must remain a dev-only audition tool. Product runtime under
`src/` other than the judge-owned review test, `public/`, `docs/`, GameState,
GameCommand, dependencies, and the CR ledger must be unchanged. The untracked
`sound/` directory is user-owned source material and is not part of the
candidate.

## Evidence claimed by the judge

- Candidate fingerprint was computed from the files listed above plus the
  acceptance brief using sorted per-file SHA-256 values.
- Judge review suite: 1 file / 6 tests passed.
- `git diff --check`: passed.
- `npm run check:forbidden` reports the expected judge-owned `review.*` change
  and research re-ownership paths. Adjudicate authorship from the scope rather
  than treating the judge test as an implementer violation.
- Re-running `research/audio/sfx-palette/render-previews.mjs` produced the same
  preview aggregate SHA-256
  `3018b1f24b2a84ff0ade40bd672174e3e4190e4183743ef401df5d7690dbd699`
  and manifest SHA-256
  `afd5cb2f90531ea832545e09e84e4a4a6a7e432ea446ffd50042d2de7ad1cf64`.
- The user-owned `sound/` aggregate SHA-256 remained
  `b6f6a2a7869fdb2911034586101b78f72e6cd2638bab925bf48ec1d34820be93`.
- In one Chromium browser session, 375×812, 812×375, and 1440×900 each
  reported nine cue buttons, no horizontal document overflow, no control below
  44 px high, defaults 70/80 with `hybrid` selected, and zero warning/error
  console entries after remediation.
- Real-browser interactions exercised palette switching, a single draw cue,
  native-loop BGM start, continuous-demo scheduling, commander playback,
  stop-all, and both volume sliders. Treat these as claims to challenge.
- Full `npm run check` has intentionally not run yet; governance requires the
  cold audit before the single full check.

## Required audit procedure

1. Read `AGENTS.md`, the acceptance brief, this brief, and every candidate file.
   Do not edit files and do not run git operations that change state.
2. Recompute the candidate fingerprint with the exact candidate paths and
   confirm the frozen tree has not drifted. Exclude this cold-audit brief and
   `.claude/loop-state.md` from that fingerprint.
3. Run the judge review test and any focused non-mutating checks needed to
   challenge it. Do not run the full `npm run check`.
4. Prove that the fixture creates exactly one BGM media element, sets native
   `loop=true`, and contains no second deck, boundary timer, manual handoff,
   equal-power gain curve, crossfade, or full-track AudioBuffer decode.
5. Check all main-palette files against the manifest and measure their actual
   sample rate, PCM bit depth, duration, and true peak independently. Normal
   cues must be at most 1.0 s, the short commander cue at most 1.6 s, and true
   peak at most -3 dBFS. The long invocation must be comparison-only.
6. Trace source provenance and fixture URLs. Confirm Kenney material is the
   locally documented CC0 source, user-supplied summon material remains
   prototype-only, and no Cockatrice, `sound/spells/`, archive, remote, or raw
   `sound/` URL enters the fixture or deliverable.
7. Trace initialization and every control path. Challenge same-row choke,
   deterministic continuous playback, BGM persistence during the sequence,
   rejection handling, stop-all, palette change, commander-only ducking, and
   gain restoration after end, rejection, replay, palette change, and stop.
8. Inspect responsive CSS and DOM at 375×812, 812×375, and 1440×900. Look for
   clipped Japanese labels, hidden horizontal overflow, unreachable controls,
   sub-44 px targets, landscape-only leakage, focus/accessibility failures, and
   JavaScript initialization errors.
9. Confirm the candidate does not modify product runtime or public assets and
   that the original `sound/` tree is not included in the candidate.

## Output

Return findings only, ordered BLOCKER/HIGH/MEDIUM/LOW. Every finding must include
an exact file and line, a reproducible check, and acceptance impact. Then list
independent checks run and limitations. If no finding exists, say so explicitly.
Do not modify any file.

## Re-audit addendum

The initial cold audit returned one HIGH, two MEDIUM, and one LOW finding. Audit
only the affected claims on the remediated candidate.

- **Remediated candidate fingerprint**:
  `15ea35c3829ddf0395814719e31904cd3a4bd1216ac8fa947c38b7df41be0e5d`
- Every playable voice, including the Web Audio thud, now exposes an idempotent
  `stop()` handle in the same active/choke registry.
- Audio-context initialization and resume failures now return a contained
  failure result to all three entry paths.
- All three initial palette buttons now expose explicit `aria-pressed` values.
- The preview README now records the renderer's actual `0.55` limiter ceiling.
- The judge review suite now reports 7/7 passing tests; `git diff --check`
  passes.
- In one fresh Chromium session, the judge rechecked 375x812, 812x375, and
  1440x900: nine cues, no horizontal overflow, no sub-44 px control, explicit
  palette ARIA values, and zero warning/error console entries. The 375x812
  interaction pass included immediate land/thud replay, stop-all, palette
  change, native-loop BGM start, immediate commander replay, and stop-all.

Recompute the remediated fingerprint and inspect the corrected control paths.
Re-run only evidence invalidated by these corrections; do not run the full
`npm run check`. Return a final `AUDIT-OK-PENDING-FULL-CHECK` only if
BLOCKER/HIGH are zero, and list any remaining lower-severity finding explicitly.
