# M-AV UI implementation cold audit — 2026-07-26

- Auditor: cold subagent `019f9d08-bf16-7832-8f06-559f14140a41` (Hegel), fork_context=false
- Brief: `research/cr-grounding/av-ui-cold-audit-brief.draft.md`
- Mode: read-only, findings only
- Verdicts: AV0 SHIPPED-OK / AV1 SHIPPED-OK / AV2 SHIPPED-OK / AV3 SHIPPED-OK / AV4 SHIPPED-OK
- BLOCKER: 0
- HIGH: 0
- MEDIUM: 0

## Findings and adjudication

1. **LOW (AV3)** — `motion.ts` retains `CelebrationKind`, `motionLevelFor`, `motionDuration`,
   `shouldCompress` with zero production callers. Adjudication: ACCEPTED without change.
   `review.d5-motion.test.ts` (judge-owned pin) intentionally pins design-system §7 motion
   levels through these exports. Removing them would break the judge pin.
2. **LOW (AV4)** — `commander-cutin-copy` keyframe animates `filter: blur()`. Contract §7
   prohibits 常時 filter use; this is a 650ms single-element one-shot ritual. Adjudication:
   ACCEPTED with exception comment added to game.css.
3. **LOW (AV2)** — 12 `will-change` declarations on fixed ambient layer containers. Not
   per-event/per-card mass production. Adjudication: ACCEPTED without change. Auditor
   confirmed no code change required.

## Evidence

- `npm run check`: 299 files, 2428 tests, lint, build — all PASS
- `git diff --check`: clean
- MP3 SHA-256 verified on disk
- Manifest matches contract §6 exactly
- Dual-stream boundary, four-event allowlist, no legacy celebration, immediate commander
  resolution, no 525ms combat clock, no FFT — all verified
- Human gates H1–H7: PENDING
