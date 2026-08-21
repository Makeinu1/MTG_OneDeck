# O4P-06F recovery cold-audit brief

Date: 2026-08-21
Milestone: `O4P-06F`
Base HEAD: `8810ed2e6db69fdc93c131f6abc195af6a763066`
Semantic candidate fingerprint before this brief:
`34e148a9866297fba5730a5c92830dd513bd255997385315d89a51d2d947ac38`

Role: context-free Luna xhigh cold auditor, findings only. Do not edit, stage,
run `npm run check`, launch Chrome, use the network, deploy, or mutate git.

Read completely:

- `AGENTS.md`, the governed development skill and document-governance;
- `research/cr-grounding/o4p-06f-full-check-repair-2.draft.md`;
- `research/cr-grounding/o4p-06f-build-repair-1.draft.md`;
- the prior product and full-check-repair-1 archive records; and
- only the two verifier scripts, their direct review tests, and the additive
  O4P-06F ordinary/Judge tests needed to audit these repairs.

Audit exact scope and prove:

1. full-check repair 2 changes only three O4P-04B/C/D frozen SHA literals in
   the O4P-05C verifier and the resulting exact O4P-05C successor SHA literal
   in the O4P-05D verifier;
2. every current byte hash matches, all old hashes are absent/non-vacuous,
   map paths and protected ranges/assertions are unchanged, no hidden successor
   remains invalidated, and both release verifiers pass;
3. build repair 1 is exactly the missing injected `json()` method and mutable
   local fixture-array type, with no expectation/value/harness/product change;
4. full `npx tsc -b`, exact targeted reviews and ordinary tests, affected
   ESLint, docs, generators, and diff checks pass;
5. prior product audit fingerprint and full-check-repair-1 audit remain
   applicable because no product or previously audited evidence semantics
   changed; and
6. dependencies, lockfile, Wrangler, workflow, package command/value,
   production, protocol, generated files, manifest, and ledger are unchanged.

Report exact candidate fingerprint and BLOCKER/HIGH/MEDIUM/LOW. Return
`AUDIT-OK-PENDING-EXACT-HEAD-CI` only when all counts are zero. Because the
local two-invocation full-check ceiling is exhausted, do not authorize or ask
for another local full check; exact-head clean-checkout CI must be the remaining
machine-check/build proof.
