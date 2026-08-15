# O4P-05D cold-audit brief

Milestone: `O4P-05D`

Base SHA: `e5b426fe93e4c4d0b25c76f51d1ca877351f8b8c`

Profile: `BROAD` (R3 production release and external-write boundary)

First read `.claude/audit-standing.md` and follow it exactly. You are a fresh
independent findings-only auditor. Do not edit tracked files, run the release
full check, use git writes, access secrets, use network services, deploy,
rollback, tail production, or mutate Cloudflare/GitHub. Do not delegate.

Authority:

- `research/cr-grounding/o4p-05d-production-release-closure.contract.draft.md`;
- `research/cr-grounding/o4p-05d-acceptance-brief.draft.md`;
- `research/cr-grounding/o4p-05d-judge-surgery-1.draft.md`;
- `research/cr-grounding/o4p-05d-judge-surgery-2.draft.md`;
- `research/cr-grounding/o4p-05d-full-check-repair-1.draft.md`;
- the candidate fingerprint supplied in the delegation message.

Audit the frozen candidate for these claims:

1. O4P-05A/B/C are the unique shipped predecessors and O4P-05D is the unique
   pending final entry in both ledger collections;
2. no production source, CR, version, dependency, Worker configuration, Pages
   workflow, or O4P-05C gate meaning drift is hidden in the checkpoint;
3. the release order prevents Cloudflare deployment before cold audit, the
   fingerprint-matched local full check, expected first-CI review-only stop,
   independent Judge reauthorization, and later exact-head green CI/Pages;
4. deploy acceptance binds a distinct active version, preserved rollback
   target, persisted revision-96 Room, fresh four-socket/revision-96 evidence,
   safe 404 envelope, and failure-before-promotion behavior;
5. secret/account/capability/raw-log material cannot enter committed evidence;
6. the verifier is registered exactly once after O4P-05C and before lint, fails
   on protected drift or frozen-authority drift, and does not weaken old gates;
7. terminal promotion requires a second findings-only production-closure audit,
   exact terminal CI/Pages, served assets, HEAD/origin equality, and clean tree;
8. rollback is bounded to the recorded former version on failed smoke, while
   resource deletion, secrets, routes/DNS, dependencies, CR updates, and the
   explicitly deferred operational controls remain out of scope.
9. Judge surgery 1 closes the first audit's three HIGH findings: plain
   forbidden is green on the locally committed candidate, a bare premature
   `shipped` ledger mutation is red, and any package-lock drift is red.
10. Judge surgery 2 closes the re-audit's two HIGH findings: the first semantic
    candidate is not overclaimed as forbidden/Pages-green, and shipped terminal
    evidence rejects secret/account/capability/raw-JSON material.
11. full-check repair 1 re-owns only the exact O4P-05D successor paths in the
    O4P-04B/C/D base-relative reviews, keeps their negative production list and
    dependency guards intact, and refreshes only the resulting frozen hashes.

Run at minimum:

```text
npm run check:forbidden
npm run verify:o4p-05c-release-gates
npm run verify:o4p-05d-production-release-closure
npx vitest run --project dom src/test/architecture/review.o4p-05d-production-release-closure.test.ts
npx vitest run --project dom scripts/__tests__/machine-checks.test.mjs
git diff --check
```

Temporarily break and restore at least one frozen contract hash, one protected
source-drift guard, and the machine-check order. Confirm byte-identical
restoration and the supplied fingerprint before returning findings.

Return concise findings with severity and reachability, actual command output,
weakening/scope/vacuity conclusions, before/after fingerprint, and totals. Only
BLOCKER 0 / HIGH 0 may return `AUDIT-OK-PENDING-FULL-CHECK`.
