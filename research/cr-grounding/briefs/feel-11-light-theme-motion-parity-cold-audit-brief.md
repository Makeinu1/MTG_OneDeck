# feel-11 light-theme motion parity — cold audit brief

- milestone: `feel-11-light-theme-motion-parity`
- base SHA: `5d790e49a0a89974cdcfcf97fab02aad8e539c1c`
- audit mode: findings only; do not edit files, docs, review tests, ledger, or git
- candidate fingerprint: judge will provide the frozen fingerprint

## Contract claims to adversarially verify

1. Existing AV5/AV6 choreography is active in both dark and light game screens when ambient motion is ON and reduced-motion is not requested: land bundles, non-land visual bundles, battlefield commander dance, command-zone commander idle, and dance-floor pools.
2. The light skin remains light: its existing tokens/palette are used, the dark backdrop layer is still hidden, and no dark-only fallback or new light asset is introduced.
3. Ambient OFF and `prefers-reduced-motion: reduce` stop all AV5/AV6 motion while leaving the static visual skin. Game-screen/outside-game behavior remains unchanged.
4. Beat duration, transport phase delay, commander/arrival phase selectors, tap mute, density decay, pointer-events, and layout geometry are unchanged. No JS per-frame loop, new PresentationEvent, SFX, BGM, or input sound is introduced.
5. Dark behavior is byte-for-byte or semantically unchanged outside the removed light stop gates. Existing audio, settings, remount, undo/redo, and reload behavior are not regressed.
6. Contract and review tests no longer encode the superseded light-silence boundary, while preserving reduced-motion and ambient OFF protections.
7. Browser evidence covers one session at 375×812, 812×375, and 1440×900 for both themes, with no console error/warn and no horizontal overflow. If actual animation inspection is unavailable, report the exact limitation and use computed CSS/source evidence only.

## Required evidence

- Read `.claude/audit-standing.md` before auditing.
- Run `npm run check:forbidden`; distinguish judge-owned review/docs files from implementation files.
- Run AV5/AV6 review tests and relevant ordinary motion/game tests. Inspect the complete diff for weakened or vacuous assertions.
- Inspect CSS selector specificity and computed animation names/durations for representative light and dark land/card/commander/pool elements.
- Do not run `npm run check`; the judge runs it after findings close on the same final fingerprint.

## Verdict format

Return findings only with severity and `file:line` plus an input→wrong-result scenario. If BLOCKER/HIGH are zero, return exactly `AUDIT-OK-PENDING-FULL-CHECK` and list evidence plus MEDIUM/LOW caveats. Do not claim shipped.
