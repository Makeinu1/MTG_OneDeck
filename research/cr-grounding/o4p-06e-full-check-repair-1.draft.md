# O4P-06E full-check repair 1

- Milestone: `O4P-06E`
- HEAD/base: `231b5e57aef87f1d66ad5a1a398bf65f5b5e2bbd`
- Audited product fingerprint: `40fe5a0f766e0899f6488b56fc89578fcb865d164e34e331f7450baac975c7c2`
- Current metadata candidate before this brief: manifest reanchor plus its audit
  brief/record, independently 0/0/0/0
- Full-check attempt: first in-sandbox invocation invalid due `tsx` IPC EPERM;
  the exact escalated invocation reached the first semantic failure at
  `verify:o4p-05c-release-gates`

## Exact failure

`scripts/checks/verify-o4p-05c-release-gates.ts` rejected the audited,
contract-authorized O4P-06E change to
`src/online/cloudflare/persistence.ts` because its historical frozen hash still
named the pre-O4P-06E bytes. The verifier stops at the first mismatch; inspect
the entire frozen map for the same already-audited O4P-06E Cloudflare paths
before editing.

## Authorized repair

This is a bounded mechanical hash-chain repair. The repair implementer may edit
only:

- `scripts/checks/verify-o4p-05c-release-gates.ts`: replace frozen SHA-256
  values only for Cloudflare production files whose current bytes differ from
  the frozen map and whose changes are already contained in audited commit
  `231b5e57...`; and
- `scripts/checks/verify-o4p-05d-production-release-closure.ts`: replace only
  the successor frozen SHA-256 for the changed O4P-05C verifier.

Do not change ranges, path sets, assertions, production/tests/reviews, package,
configuration, workflow, docs/manifest, generated files, ledger, audit records,
or any other frozen authority. Compute SHA-256 from current bytes, prove every
unchanged frozen entry still matches, and prove every replacement old hash
differs from the current file while the new hash equals it.

Run only both release verifiers, their two architecture/Judge review files,
TypeScript, affected ESLint, and diff checks. Do not run `npm run check`, edit
the loop state, mutate git, access network, audit your own work, or publish.
Freeze and report exact changed paths, old/new hashes, affected evidence, and
the canonical tree fingerprint.
