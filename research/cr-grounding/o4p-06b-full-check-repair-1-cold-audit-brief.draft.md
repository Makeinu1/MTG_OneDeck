# O4P-06B Full-Check Repair 1 Cold-Audit Brief

Milestone: `O4P-06B`
Base HEAD: `02ec9141b22f70d7f9ce5745a7b0ee5b71751f08`
Repair brief: `research/cr-grounding/o4p-06b-full-check-repair-1.draft.md`
Repaired context fingerprint before this audit brief:
`17286189cbad301484077bf1c801e043f7a8f40243603dc34416151e81d43414`
Semantic fingerprint excluding the repair brief:
`639d63118e3b0881d08053810e44f6f34cc6005c4a97abee63cac82fcce4cb28`
Role: context-free cold auditor, findings only

## Bounded candidate

- `docs/contracts/manifest.json` — previously audited one-line generated-API
  verification re-anchor;
- `scripts/checks/verify-o4p-05c-release-gates.ts`;
- `src/test/architecture/review.o4p-05c-release-gates.test.ts`;
- `scripts/checks/verify-o4p-05d-production-release-closure.ts` — mechanical
  frozen-hash re-anchor only; and
- the Judge-owned repair brief and this audit brief.

No O4P-06B product source, generated API, package/lock/config/workflow,
dependency, version, ledger, or unrelated review byte may differ from base.

## Audit priorities

1. Both O4P-05C historical scope comparisons must use exact range
   `7dc41384bf6763986a47151d69f78f31021976fe..e5b426fe93e4c4d0b25c76f51d1ca877351f8b8c`,
   not the live tree or a permissive allowlist.
2. The O4P-05C verifier must retain its live production import/barrel scan,
   frozen Cloudflare/configuration hashes, dependency/CR pin assertions, and
   exact review hashes.
3. The O4P-05D verifier must retain its exact closure comparison and live
   untracked protected-path rejection; only the O4P-05C verifier hash may be
   re-anchored.
4. Recompute the review/verifier hashes independently and reproduce the
   candidate fingerprints.
5. Prove without retained mutations that a wrong O4P-05C closure reveals the
   successor drift and an untracked protected source file is rejected.

## Required bounded checks

```sh
npm run verify:o4p-05c-release-gates
npm run verify:o4p-05d-production-release-closure
npx vitest run --project dom src/test/architecture/review.o4p-05c-release-gates.test.ts src/test/architecture/review.o4p-05d-production-release-closure.test.ts src/test/architecture/review.o4p-06-roadmap-registration.test.ts scripts/__tests__/machine-checks.test.mjs
npx eslint scripts/checks/verify-o4p-05c-release-gates.ts scripts/checks/verify-o4p-05d-production-release-closure.ts src/test/architecture/review.o4p-05c-release-gates.test.ts
npx tsc -b
git diff --check
```

Do not edit files, create records, run `npm run check`, perform git mutations,
or use the network. Return BLOCKER/HIGH/MEDIUM/LOW counts with precise evidence.
Only a clean bounded verdict is `AUDIT-OK-PENDING-FINAL-FULL-CHECK`.
