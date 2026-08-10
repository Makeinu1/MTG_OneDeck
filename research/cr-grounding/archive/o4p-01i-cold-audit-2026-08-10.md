# O4P-01I cold-audit record

- Milestone: O4P-01I Stack Announcement Payload & Lifecycle V1
- Auditor: `019fe93e-0b66-71f0-b9fe-b6cfaf049e07` (Noether)
- Initial BASE_SHA: `aad8b24b9a0fcfe0a8dad51dc28095d1a0348966`
- Final audited candidate SHA: `9f7b582249ca6235f0b2ab846242e1286cb41f3e`
- Final audited candidate fingerprint: `ccd5478923e5f6840444c24f3702485af1692370b2c11d5f5ce2646b90e5f618`
- Verdict: `AUDIT-OK-PENDING-FULL-CHECK`

## Severity counts

| Stage | BLOCKER | HIGH | MEDIUM | LOW |
|---|---:|---:|---:|---:|
| Initial audit | 0 | 2 | 0 | 0 |
| Final re-audit | 0 | 0 | 0 | 0 |

## Findings and closure

The initial audit matched fingerprint `346f44fb789ffadacffaef95cc0938d0d878df09659fe4e32c955e37bbe874fa` and found:

1. `stackAnnouncementPropertyV1.test.ts` used `{}` instead of the committed
   Object Registry V2 fixture, so the property failed before exercising the
   announcement input. The judge replaced it with the valid registry fixture
   and a non-record root generator.
2. Target-reference validation did not guard nested hostile proxy inspection.
   Foundation repair attempt 1 guarded prototype, own-key, and descriptor
   inspection and added adversarial tests.

The first re-audit also exposed a seed-dependent accepted-case property defect
in `targetAnnouncementV1Property.test.ts`; the F lane made generated group
keys unique per row. The next re-audit found an unguarded selection/array proxy
path; F repair attempt 2 guarded prototype, own-key, descriptor, length, and
index inspection and added adversarial tests. The judge then performed one
type-only `number` narrowing for array length so both build and the scripts
TypeScript project passed.

The final re-audit recomputed the final fingerprint, verified the repaired
paths and the complete audit checklist, and returned BLOCKER/HIGH/MEDIUM/LOW
counts of 0/0/0/0. The auditor did not edit files, change git state, or run the
release full check.

## Focused evidence before full check

- O4P-01I Core stack suite: 13 files / 40 tests passed.
- Architecture and machine-check tests: 3 files / 12 tests passed.
- `verify:mode-neutral-core-stack-announcement`: passed with 4 stack objects,
  one of each supported kind, validation/canonical/roundTrip/frozen all OK.
- `npx tsc -p scripts/checks/tsconfig.json`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run check:forbidden`: FORBIDDEN 0.
- `git diff --check`: passed.
- `package-lock.json`, dependencies, version axes, Solo product code, and
  Online runtime were unchanged.

## Final full-check evidence

After the boundary-corrected candidate re-audit, the judge ran the final full
`npm run check` once. All 12 machine-check steps passed: CR, versions, Solo,
Online architecture, Identity/Zone, Card Runtime, Zone Transition, Object
Registry V2, Stack Announcement, lint, Core 166 files/1659 tests plus DOM 242
files/1719 tests, and build. `npm run check:forbidden` returned FORBIDDEN 0
and `git diff --check` passed on the same candidate fingerprint.

Full `npm run check`, ledger audited transition, CI, Pages, and shipment were
not part of the cold audit and remain judge-owned gates.

## Post-audit full-check attribution

The first post-audit full-check attempt ran all preceding machine steps,
including the new Stack Announcement verifier, lint, and the Core project
(166 files / 1,659 tests), then failed in the DOM architecture project because
`modeNeutralCoreBoundary.test.ts` did not yet allow the new verifier script.
The judge added only that verification-script allowlist entry; the focused
boundary test passed 7/7. This changed the candidate from
`0c7e58ad174a36332c68ac357dc6b55045676ac7` /
`b37b0e8f330be331a727193c820701c1cb38fda5f125126ace69dd8c1d6d8ae1` to
`9f7b582249ca6235f0b2ab846242e1286cb41f3e` /
`ccd5478923e5f6840444c24f3702485af1692370b2c11d5f5ce2646b90e5f618`.
A fresh cold re-audit is required before the final full check.

The fresh re-audit of the boundary-corrected candidate recomputed the
fingerprint and returned `AUDIT-OK-PENDING-FULL-CHECK` with
BLOCKER/HIGH/MEDIUM/LOW counts of 0/0/0/0. The final full check is the next
judge-owned gate; it subsequently passed as recorded above.
