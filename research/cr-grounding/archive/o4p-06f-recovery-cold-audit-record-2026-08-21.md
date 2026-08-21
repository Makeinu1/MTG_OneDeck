# O4P-06F recovery cold-audit record

Date: 2026-08-21
Milestone: `O4P-06F`
Base HEAD: `8810ed2e6db69fdc93c131f6abc195af6a763066`
Auditor: `/root/o4p06f_luna_recovery_auditor` (Luna xhigh, context-free)

Audited semantic fingerprint:
`34e148a9866297fba5730a5c92830dd513bd255997385315d89a51d2d947ac38`.
Context fingerprint including the authority brief:
`f681820f4fee00f6e5859d614cb8cb3f3c00df5f41bd23b2af03feabe72f0312`.

## Scope and evidence

Full-check repair 2 changed only three O4P-04B/C/D frozen review SHA-256
literals in `verify-o4p-05c-release-gates.ts` and the resulting O4P-05C
verifier successor SHA in `verify-o4p-05d-production-release-closure.ts`.
All current hashes match; all old values are absent and non-vacuous; replacing
the four new literals with their old values normalizes both verifier files
byte-identically to HEAD. No path map, protected range, assertion, or verifier
semantics changed.

Build repair 1 changes exactly two type-only lines in the additive ordinary
test: the injected response implements its required `json()` method and the
local hostile-mutation fixture array is mutable. An independently recovered
prior blob differs on only those two lines; no expectation, value, harness, or
product semantics changed.

- context projection and fingerprints matched; staged-only, no unstaged files;
- targeted reviews: 8 files / 36 tests passed;
- full `npx tsc -b`, affected ESLint, docs, engine API generator, migration-map
  byte equality, and diff checks passed;
- direct `node --import tsx/esm` O4P-05C and O4P-05D verifiers passed;
- the equivalent npm verifier commands encountered only sandbox IPC `EPERM`,
  recorded as an environment caveat rather than a semantic failure;
- no product, dependency, lockfile, Wrangler, workflow, package value,
  generated, manifest, ledger, protocol, or Worker change occurred;
- prior product audit at `8e9fc60f...` and full-check-repair-1 audit at
  `98a3ce6d...` remain applicable.

Findings: `BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`.

Verdict: `AUDIT-OK-PENDING-EXACT-HEAD-CI`. The local two-invocation full-check
ceiling is exhausted; do not run another local full check. Exact-head
clean-checkout CI must supply the remaining complete machine-check/build proof.
