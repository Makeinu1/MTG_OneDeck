# O4P-01K Cold-Audit Record

- Auditor: `019feac9-53c3-7f61-8a08-bfbc0e4cdce2`
- Candidate SHA: `a215ec335ea6e98364f43974074c53df1df17f4c`
- Candidate fingerprint: `aaf78f1966e0211a978a4797e5917bc8e7ecb2d8606fdd233264ef09a255f4a0`
- Result: `AUDIT-OK-PENDING-FULL-CHECK: NO`
- BLOCKER/HIGH count: `3`

## Findings

1. `HIGH`: Pending triggers can bypass trigger placement and position advance. `turnPriorityBundleValidationV1.ts:211-215` checks only an empty stack for `position-advance-ready`; `turnAdvanceV1.ts:351-369` preserves pending triggers while advancing. The auditor reproduced a valid bundle with five pending triggers advancing. Basis: frozen contract §8, lines 242-255; CR 117.5 and 704.3.

2. `HIGH`: Lifecycle validation accepts extended Array instances. `turnLifecycleValidationV1.ts:287-368` validates array descriptors without requiring `Array.prototype`, and an Array subclass was accepted. Basis: frozen contract §14, lines 378-386.

3. `HIGH`: Operation input boundaries accept hostile class/accessor inputs. `sbaTriggerBoundaryV1.ts:35-49` accepts a class instance for `actionsWereApplied`; `turnAdvanceV1.ts:356-358` reads `operation.nextPosition` without descriptor validation, executing and accepting an accessor. Basis: frozen contract §14, lines 378-386.

## Disposition

Ship is prohibited. Correct the findings, rerun the affected acceptance/property/architecture tests, and obtain a targeted cold re-audit of the corrected candidate before any full check or ledger status change.
