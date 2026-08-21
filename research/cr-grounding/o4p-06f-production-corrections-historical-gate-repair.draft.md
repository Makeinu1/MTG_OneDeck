# O4P-06F production corrections historical-gate repair

Date: 2026-08-21
Milestone: `O4P-06F`
Base HEAD: `6a12b8e0f139547a2d1f336c2f612ec0db20aed3`
Audited product fingerprint:
`a9637c2a7e3777ae3280d69fcdb5b93f68af27354d829895e22ca057667a7447`
Audit record:
`research/cr-grounding/archive/o4p-06f-production-corrections-cold-audit-record-2026-08-21.md`
Risk: R3 Judge-owned mechanical historical-gate reauthorization

## Trigger

The independently audited production correction has findings
`BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`. Two historical gates now stop
non-semantically:

- the O4P-06F review's exact changed-source list predates the three Cloudflare
  correction files and the one exact Core-boundary registration;
- the O4P-03D production verifier requires the obsolete literal
  `else this.validateCheckpoint(state)` even though the audited implementation
  now performs a closed marker-hit check and full replay on a miss.

## Exact repair boundary

Judge may change only:

- `src/test/architecture/review.o4p-06f-four-browser-production-release.test.ts`;
- `scripts/checks/verify-online-cloudflare-production-gate.ts`;
- `scripts/checks/verify-o4p-05c-release-gates.ts`;
- `scripts/checks/verify-o4p-05d-production-release-closure.ts`;
- this authority draft and its later cold-audit brief/record.

The O4P-06F review adds exactly the three audited Cloudflare product/ordinary
paths and `src/test/architecture/modeNeutralCoreBoundary.test.ts` to its sorted
closed changed-source list. The O4P-03D verifier replaces only the stale regex
with exact marker/digest/cache-miss/initialization/accepted-commit assertions.
The O4P-05C verifier reanchors only bytes it already freezes, and O4P-05D
reanchors only the resulting direct O4P-05C successor hash.

No product, ordinary test, Core, protocol, runtime, Worker, public API,
dependency, package/lock, Wrangler, workflow, docs/generated, manifest, ledger,
version, deployment, or audit-record semantic may change. No assertion may be
deleted or weakened; no prefix, glob, broad directory, alternate range, dead
comment, regex bait, or fake-green is allowed.

## Done when

The two previously failing gates pass, the exact O4P-05C/O4P-05D hash chain is
green and non-vacuous, targeted reviews/static/docs/diff checks pass, and a
context-free Luna xhigh audit reports zero BLOCKER/HIGH before exact-head CI.
Do not run local full `npm run check`, Chrome, network, deployment, git commit,
push, ledger mutation, or publication in this repair stage.
