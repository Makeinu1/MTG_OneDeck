# feel-10 light theme BGM selection — cold-audit record

- milestone: `feel-10-light-theme-bgm-selection`
- base SHA: `f1dc005cb0bc0644163471ea20e0f231c797e0a4`
- initial audited candidate fingerprint: `f98fa3930d9b387cc329b3dfbe5996e81a4aa3ad9d1645d37d51dad1aa94e867`
- metadata-inclusive audit candidate fingerprint: `504c41eb01a0c0e115bd58ee4854a37092455d2d9dca01af26a15dfdc38eefe3`
- post-check-repair candidate fingerprint: `b418da333df6625e96a4f038e1ed5bc33750dc8c276c321d49a708b7037fb3c1`
- auditor: `019fe121-d421-7d20-bcaa-2f25602ffdad` (independent, findings only)
- date: 2026-08-08

## Verdict

Final cold re-audit verdict: `AUDIT-OK-PENDING-FULL-CHECK`.

- 17 related review files / 151 tests passed.
- `sound/ライトテーマ.mp3` and `public/audio/bgm/light-theme.mp3` are byte-identical; SHA-256 is `d73ab88a9a665dd684376d9e167f66297d909a6a63a6de195dcc455023c15148`.
- Dark Track pins remained unchanged. Light policy, selected native-loop plan, light-grid timing, independent settings, semantic event allowlist, menu copy, and future null-track guard passed adversarial review.
- Browser checks covered light/dark at 375×812, 812×375, and 1440×900; light start/opening-hand/keep/draw/menu flow and theme switching passed, with no horizontal overflow and console errors/warnings at 0.
- The browser environment exposed neither `AudioContext` nor `<audio>`, so actual BGM/SFX playback remains a separate human-listening gate.
- `npm run check:forbidden` reported `NEEDS-REAUTH` for judge-owned docs/archive/brief/ledger paths and `FORBIDDEN` only for judge-owned `review.*` files. No implementer-owned protected path was emitted.
- `git diff --check` passed. The release `npm run check` is pending and must run once on the final post-record fingerprint.

## Finding adjudication

The initial audit found one LOW in `docs/design-system.md:221-222`: the active guidance still described light-theme audio as silent. The judge updated that active guidance to state that BGM follows the theme's selected Track and existing semantic SFX remain available in both themes. The subsequent re-audit found no BLOCKER, HIGH, MEDIUM, or LOW findings.

This record is not a shipment approval. Human listening for light BGM/SFX level, latency, loop behavior, and repetition fatigue remains separate; commit, push, CI, and Pages publication are not part of this milestone.

## Full-check repair loop

The first post-audit `npm run check` stopped at lint because the ordinary light-asset test used a Vitest matcher whose inferred type triggered `@typescript-eslint/no-unsafe-assignment` at `src/components/game/presentation/__tests__/av0-presentation.test.ts:37`. The assertion was rewritten as direct `toContain` / `toBe` checks. Targeted lint, 11-file/126-test suite, `tsc -b`, SHA verification, and `git diff --check` passed after the repair. The repaired candidate requires this cold-audit recheck before the second and final allowed `npm run check`.
