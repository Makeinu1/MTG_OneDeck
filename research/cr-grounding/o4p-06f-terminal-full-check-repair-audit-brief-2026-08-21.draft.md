# O4P-06F Terminal Full-Check Repair Cold-Audit Brief

Milestone: `O4P-06F`
Base HEAD: `d4a77837901861f91b23f5eb389bfabccc1b6744`
Failed exact-head run: `32490769065`
Role: context-free findings-only repair auditor

Audit exactly:

- `src/test/architecture/review.o4p-06f-four-browser-production-release.test.ts`;
- this brief; and
- read-only CI failure evidence and immutable terminal candidate at the base.

The failure was one stale exact changed-source list: the newly audited terminal
roadmap review was the sole received path absent from the expected O4P-06F
boundary. Confirm the repair adds exactly the literal
`src/test/architecture/review.o4p-06-roadmap-registration.test.ts` and no prefix,
regex, package, product, protocol, Worker, persistence, ledger, workflow, or
generated-file widening. Removing only the constant and expected-list entry must
restore the review bytes at base. The old nine-path list must fail non-vacuously
on the current ten-path source tree.

Run only the two invalidated roadmap/O4P-06F review files, affected ESLint,
TypeScript, docs/API checks, and diff/ownership scans. Independently verify the
CI log reports every verifier and lint passed, Core passed, and DOM failed only
this one assertion (323 files/2197 tests passed plus one skipped; one failed).
Do not run `npm run check`, edit, mutate git, push, deploy, or access secrets.

Return BLOCKER/HIGH/MEDIUM/LOW and
`AUDIT-OK-PENDING-FINAL-FULL-CHECK` only if exact. The expected Judge-owned
review ownership stop remains a separate CI-reauthorization boundary.
