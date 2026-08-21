# O4P-06F production corrections historical-gate repair cold-audit brief

Date: 2026-08-21
Milestone: `O4P-06F`
Base HEAD: `6a12b8e0f139547a2d1f336c2f612ec0db20aed3`

You are a context-free Luna xhigh cold auditor. Read only this brief first, then
fully read `AGENTS.md`, the governed development skill/document-governance,
`docs/judge-protocol.md`, the repair authority
`research/cr-grounding/o4p-06f-production-corrections-historical-gate-repair.draft.md`,
and the applicable product audit record
`research/cr-grounding/archive/o4p-06f-production-corrections-cold-audit-record-2026-08-21.md`.

Audit findings only. Do not edit files, mutate git, run full `npm run check`,
use Chrome/network/Cloudflare/GitHub, deploy, publish, or expose credentials,
Room identifiers, account data, raw frames, request bodies, or secrets.

## Exact repair boundary

Relative to the already audited product tree, the repair adds this brief and
the repair authority and changes only:

- `src/test/architecture/review.o4p-06f-four-browser-production-release.test.ts`;
- `scripts/checks/verify-online-cloudflare-production-gate.ts`;
- `scripts/checks/verify-o4p-05c-release-gates.ts`;
- `scripts/checks/verify-o4p-05d-production-release-closure.ts`.

No product, ordinary test, harness, Core, protocol, runtime, Worker, dependency,
package/lock, Wrangler, workflow, docs/generated, manifest, ledger, version, or
prior audit-record byte may change during this repair.

## Required hostile audit

1. Prove the O4P-06F review adds exactly the three audited Cloudflare
   correction paths and one exact Core-boundary registration to its sorted
   closed source list. Removing only those entries must restore its prior bytes,
   and the prior list must fail non-vacuously against the current product tree.
2. Prove the O4P-03D verifier replaces only the obsolete
   `else this.validateCheckpoint(state)` assertion. Its new assertions must
   require the strict recovery-verification table/digest, exact checkpoint-byte
   digest comparison, full replay plus transactional marker write on migration
   miss, replay-backed initialization marker, and accepted-command marker
   update. Reject dead comments, inert matches, widened import/source paths, or
   a regex that can pass without the audited implementation.
3. Recompute the O4P-05C frozen map. Its path set must be unchanged and only
   `src/online/cloudflare/persistence.ts` plus the O4P-03D verifier hashes may
   differ from the previous map; every current byte must match. Recompute the
   O4P-05D map and require only the direct O4P-05C successor hash change.
   Replacing those exact literals with prior values must normalize both files
   byte-identically to their pre-repair candidate bytes, and old values must
   fail non-vacuously.
4. Run the production, O4P-05C, and O4P-05D verifiers; the O4P-06F, O4P-03D,
   O4P-05C, O4P-05D, and mode-neutral Core targeted reviews; TypeScript,
   affected ESLint, docs/API generator, and staged/unstaged diff checks. Do not
   run the full check.
5. Confirm the applicable product audit remains exact: excluding repair files,
   the product fingerprint is unchanged and the prior 0/0/0/0 verdict still
   applies. Confirm the repair contains no secret, raw JSON, product assertion
   deletion, path-prefix/glob widening, alternate protected range, package or
   external-state mutation.

Report exact fingerprint and `BLOCKER n / HIGH n / MEDIUM n / LOW n`.
Authorize `AUDIT-OK-PENDING-EXACT-HEAD-CI` only with every count zero. The two
local full-check invocation ceiling is exhausted; exact-head CI is the next
complete check and must not be substituted locally.
