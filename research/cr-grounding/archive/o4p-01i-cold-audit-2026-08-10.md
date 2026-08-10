# O4P-01I cold-audit record

- Milestone: O4P-01I Stack Announcement Payload & Lifecycle V1
- Auditor: `019fe93e-0b66-71f0-b9fe-b6cfaf049e07` (Noether)
- Initial BASE_SHA: `aad8b24b9a0fcfe0a8dad51dc28095d1a0348966`
- Final audited candidate SHA: `0c7e58ad174a36332c68ac357dc6b55045676ac7`
- Final audited candidate fingerprint: `b37b0e8f330be331a727193c820701c1cb38fda5f125126ace69dd8c1d6d8ae1`
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

Full `npm run check`, ledger audited transition, CI, Pages, and shipment were
not part of this audit and remain judge-owned gates.
