# VALIDATION-HARDENING-2026-08 cold audit findings

- Auditor: independent cold auditor `019ff01b-3035-7300-86e9-4194d4480406`
- Audit profile: BROAD
- Candidate before audit record: `74f6394`
- Final audit status: `AUDIT-OK-PENDING-FULL-CHECK`
- BLOCKER/HIGH: 0

## Findings closed during the audit sequence

1. Normal Pages forbidden scanning initially rejected marker-only changes to protected `review.*` tests. Markers were moved to non-review evidence files; the default policy remained fail-closed and the final changed-path scan reports zero forbidden paths.
2. Legacy inventory initially promoted structural headings, table headers, status metadata, withdrawn material, and limitation/retraction notes. The shared legacy policy now defers those items and permits active dispositions only for explicit normative language or numbered acceptance rows. `check-docs` enforces the same rule against the committed inventory.
3. Diff-base resolution initially accepted a valid but non-ancestor ref. Resolver and change detector now reject non-ancestor base/head pairs.
4. Stale verification initially relied on index-sensitive diff state. `check-docs` now compares commit blob hashes with working-tree hashes and includes every active clause `verifiedBy` path and the traceability registry.
5. Active clauses now require non-empty source markers and acceptance evidence.

## Final audit evidence

- `check-docs` passed.
- Targeted validation tests passed: 6 files, 29 tests.
- Default forbidden policy passed; no changed `review.*` path was detected.
- Clause IDs, markers, acceptance references, inventory hashes, disposition rules, ancestry checks, and assume-unchanged evidence checks passed.
- No deleted tests, skip/todo conversions, weakened assertions, runtime source changes, or `git diff --check` errors were found.
- The cold auditor did not run the full `npm run check`; that remains the judge-owned release gate.
