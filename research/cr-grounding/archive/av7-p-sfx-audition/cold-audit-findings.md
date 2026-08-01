# AV7-P-SFX-AUDITION cold-audit record

- Auditor: `/root/av7p_cold_audit`
- Initial fingerprint:
  `1135e8563e893e568e6d608b7a1dfefc5e63b3a938b38973ab431801fa1cb612`
- Initial verdict: BLOCKER 0 / HIGH 1 / MEDIUM 2 / LOW 1

## Initial findings

1. HIGH: the Web Audio low-thud oscillator was not present in the active voice
   registry, so row replay, palette change, and stop-all could leave up to
   160 ms of the prior thud audible.
2. MEDIUM: `AudioContext.resume()` rejection escaped the BGM, cue, and
   comparison entry paths as an unhandled rejection.
3. MEDIUM: the two initially unselected palette buttons omitted
   `aria-pressed="false"`.
4. LOW: the preview README documented a `0.7` limiter ceiling while the
   renderer and manifest used `0.55`.

All four were classified as bounded fixture implementation/documentation
defects. No contract, product-runtime, GameState, GameCommand, public-asset, or
CR ambiguity was involved.

## Remediation

- Remediated fingerprint:
  `15ea35c3829ddf0395814719e31904cd3a4bd1216ac8fa947c38b7df41be0e5d`
- The thud and media voices now share idempotent stop handles in the active
  registry.
- Audio startup failure is contained and reported to the fixture status.
- Initial palette ARIA state and limiter documentation are explicit and
  consistent.
- Judge review evidence: 1 file / 7 tests passed.
- Browser remediation evidence: 375x812, 812x375, and 1440x900 passed the
  affected layout, accessibility, interaction, and console checks.

## Final re-audit

- Verdict: `AUDIT-OK-PENDING-FULL-CHECK`
- Findings: BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0
- The auditor independently recomputed the remediated fingerprint and traced
  every corrected control path.
