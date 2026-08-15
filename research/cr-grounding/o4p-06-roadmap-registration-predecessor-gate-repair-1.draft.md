# O4P-06 Roadmap Registration — Predecessor Gate Repair 1

Date: 2026-08-15<br>
Base SHA: `69559e13716e9d0767d8189714d8c14fb630db46`<br>
Owner: Judge

## Trigger

After semantic cold audit and before the final full check, the two bounded
O4P-05D predecessor targets were run. Both failed because the shipped closure
gate encoded two historical assumptions: `activeProgram` must remain exactly
O4P-05 forever, and no later Judge-owned review file may exist.

## Repair

- Preserve every O4P-05A through D status, dependency, release record, frozen
  production/configuration hash, and release assertion.
- Permit only the exact O4P-06 active-program shape approved on 2026-08-15 in
  addition to the historical exact O4P-05 shape.
- Permit only
  `src/test/architecture/review.o4p-06-roadmap-registration.test.ts` as the new
  successor review path under the O4P-05D protected-drift check.
- Update the O4P-05D verifier's frozen hash for its Judge-owned review after
  these assertion-only changes.

This does not make future arbitrary active programs or review paths valid.
O4P-07 or any other successor must return through a new Judge registration
boundary. No product source, protocol, dependency, workflow, Worker config,
ruleset, deployment, or O4P-05 release evidence changes.
