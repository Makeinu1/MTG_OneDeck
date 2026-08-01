# AV7-PRODUCTION-INTEGRATION pre-release cold-audit brief

Read `AGENTS.md` and `.claude/audit-standing.md` first.

- **Base SHA**: `fdcac70bc8a9c4b6ab519163d04bf70fe4712e39`
- **Claimed status**: `implemented-not-audited`
- **Implementation brief**: `research/cr-grounding/av7-production-integration-brief.draft.md`
- **Contract**: `docs/audio-visual-contract.md` §§2–6, §12
- **Acceptance**: `docs/acceptance.md` M-AV
- **Candidate fingerprint**: `6068034ce3ce586ab5a6744b6ca10f78f09d6d5136ea80e94ea1739586081329`
- **Full-check state**: intentionally pending; do not run `npm run check`

The candidate fingerprint is SHA-256 over the binary `git diff` from base plus
the SHA-256/path lines of every untracked file. It excludes only
`.claude/loop-state.md`, this audit brief,
`research/cr-grounding/archive/av7-production-integration/**`, and `sound/**`.
The excluded user source tree is independently pinned at
`b6f6a2a7869fdb2911034586101b78f72e6cd2638bab925bf48ec1d34820be93`.

Reproduce the candidate fingerprint from the repository root with:

```sh
{ git diff --binary --no-ext-diff HEAD -- . ':(exclude).claude/loop-state.md' ':(exclude)sound/**' ':(exclude)research/cr-grounding/av7-production-integration-cold-audit-brief.draft.md' ':(exclude)research/cr-grounding/archive/av7-production-integration/**'; git ls-files --others --exclude-standard -z | while IFS= read -r -d '' f; do case "$f" in sound/*|research/cr-grounding/av7-production-integration-cold-audit-brief.draft.md|research/cr-grounding/archive/av7-production-integration/*) continue ;; esac; shasum -a 256 "$f"; done; } | shasum -a 256
```

## Claims to attack

1. BGM uses exactly one `HTMLMediaElement`, one media source, native `loop=true`,
   and no second deck, manual boundary seek, crossfade timer, equal-power gain,
   or `TrackManifest.crossfadeMs`. Same-page remount position, dark-only
   audibility, gesture unlock, and BGM slider behavior remain intact.
2. `public/audio/sfx/` contains exactly 13 approved PCM16/stereo/48kHz WAVs and
   local CC0/project-original rights evidence. Preview-derived bytes remain
   pinned; comparison/Cockatrice/`sound/spells`/archives do not leak public.
   Every normal asset is <=1s, commander asset <=1.6s, and <=-3 dBTP.
3. The fixed manifest matches the contract exactly. A cue plays only when every
   declared layer is decoded, reuses source buffers by path, does not randomize,
   and chokes only the previous tail of the same semantic group. Fetch/decode/
   play failure is silent and never blocks game state. A transient fetch/decode
   failure is not permanently cached: the next explicit gesture or audio-setting
   operation retries it, while the settings menu reports audio error until ready.
4. Draw, tap/untap, bulk tap/untap, shuffle, resolve-top/all, land, ordinary cast,
   turn advance, and commander cast publish exactly once only after successful
   UI-initiated forward evidence. Multi-card/bulk/all operations aggregate to
   one cue. Automatic mana/effect side effects, no-op/failure, confirmation or
   payment wait, manual-required arrival, cancel/abort, hover/menu, undo/redo,
   restore, and remount publish zero.
5. Delayed fetch/guided/manual resolution emits only after at least one original
   stack ID leaves the stack, once per initiating resolve operation. Aborting or
   using history clears the pending presentation intent.
6. Ordinary seven cues use EventBus and never duck BGM. Commander alone uses
   CommanderBus, the fixed 3-layer motif, 650ms cut-in, and existing -4dB duck.
   BGM/SFX controls remain the only settings and saved/default 70/80 gains are
   applied immediately after gesture-created buses.
7. No `GameState`, `GameCommand`, snapshot schema, engine meaning, dependency,
   or user `sound/` byte changed. The game remains operable without audio.

## Judge evidence to challenge

- Relevant targeted suite: 19 files / 216 tests PASS; repaired judge boundary
  suite: 4 files / 13 tests PASS.
- MEDIUM correction evidence: retry/status target 5 files / 28 tests PASS, then
  final affected review rerun 3 files / 18 tests PASS; affected ESLint PASS.
- Targeted ESLint PASS after the final judge repair; `git diff --check` PASS.
- Production audio: all 13 assets 48kHz/stereo/PCM16; measured true peaks range
  from -12.5 to -4.8 dBTP. BGM + ordinary spell + commander worst-case mix at
  every 32-beat anchor measured at most -7.0 dBTP.
- Browser session PASS at 1440x900, 375x812, and 812x375: viewport equals game
  root, horizontal overflow zero, draw/tap/manual resolve/commander routes
  operable. Light 375x812 remains operable. Browser console error/warning = 0.
- `sound/` aggregate remains
  `b6f6a2a7869fdb2911034586101b78f72e6cd2638bab925bf48ec1d34820be93`.

## Required audit procedure

1. Recompute both fingerprints and inspect every changed/untracked path against
   base. Confirm judge/implementer ownership and no dependency/engine/sound drift.
2. Run `npm run check:forbidden`; inspect protected findings rather than treating
   the scanner alone as pass/fail.
3. Run the AV7 judge evidence under `--project dom`: `review.av0-contract`,
   `review.av1-presentation-events`, `review.av2-runtime-settings`,
   `review.av3-semantic-runtime`, `review.av4-commander-ritual`,
   `review.av7-production-integration`,
   `review.av7-production-events-runtime`, `review.av7-sfx-readiness`,
   `review.av7p-audition-fixture`, and
   `review.av7p2-spell-commander-refine`. Do not run the full suite.
4. Inspect deleted test/source lines for weakening. Confirm the old generated
   patch/crossfade tests were replaced by stronger native/sample evidence.
5. Perform vacuity checks by temporarily breaking at least native loop, partial
   readiness, and one controller history/success boundary. Restore byte-identical.
6. Adversarially inspect all UI entry routes and delayed resolve cancellation.
   Verify no direct store route accidentally produces SFX and no success route
   bypasses the controller projection.
7. Inspect/measure all production WAVs and the combined mix. Confirm the license
   mapping and public allowlist.
8. In one stable browser session, verify 375x812, 812x375, 1440x900 and dark/light,
   perform representative draw/tap/resolve/cast operations, and require console
   error 0. Do not make a subjective final sound-taste decision for the user.

## Constraints and output

- Findings only. Do not edit, stage, commit, push, change docs, or retain any
  temporary mutation.
- Do not run `npm run check`; the judge runs it once after a clean audit on the
  identical fingerprint.
- Each finding: BLOCKER/HIGH/MEDIUM/LOW + exact file:line or deterministic
  reproduction + reachable impact.
- If BLOCKER/HIGH = 0, return `AUDIT-OK-PENDING-FULL-CHECK` and list the evidence
  actually executed. This is not ship approval.
