# O4P-07C Full-Check Repair 2

Date: 2026-08-23
Base SHA: `3a0f615b1702560634ae5f4f32dac72d732e8a5d`
Owner: Judge

## Trigger

Replacement exact-head Actions run `32615426397` passed the repaired executable
hash chain and ran the canonical suite for 12 minutes 28 seconds. Vitest then
reported seven historical review-expectation failures:

- O4P-03A, O4P-03B, O4P-03C, and O4P-07A review allowlists lacked the exact
  audited `runtime.ts -> ../room/validationSupport` import;
- O4P-04B, O4P-04C, and O4P-04D review script inventories lacked the exact
  `verify:o4p-07c-production-runtime` package script introduced by O4P-07C.

No runtime, component, protocol, persistence, Scryfall, dependency, build, or
browser failure was reported. Ownership classification and Pages deploy did not
run.

## Bounded deterministic repair

1. Add only `../room/validationSupport` to the four named review-test import
   allowlists.
2. Add only `verify:o4p-07c-production-runtime` to the three named sorted script
   inventories and assert its exact command value.
3. Preserve every other review assertion, candidate-path allowlist, dependency,
   viewport, source boundary, and release requirement.

No product source, package byte, review ownership rule, CR authority, public UI,
Worker behavior, or online protocol behavior changes in this repair.

## Required evidence

- The seven affected review files pass together and remain non-vacuous.
- Affected ESLint and `git diff --check` pass.
- A fresh Luna xhigh cold audit reports BLOCKER/HIGH 0.
- `document-governance.md` permits at most two full-check invocations in this
  task; runs `32614875094` and `32615426397` consumed both. A third exact-head
  CI/full-check must not be started without an explicit user exception.
