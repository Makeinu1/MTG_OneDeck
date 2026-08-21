# O4P-06F production corrections CI reauthorization cold-audit brief

Date: 2026-08-21
Milestone: `O4P-06F`
Candidate HEAD: `df71d8c8552a24419eb235f0df20887922ee9f04`
Authority record:
`research/cr-grounding/o4p-06f-production-corrections-ci-reauthorization-record.draft.md`

You are a context-free Luna xhigh cold auditor. Read only this brief first,
then fully read `AGENTS.md`, the governed development skill and
document-governance, `docs/judge-protocol.md`, the authority record, the two
production-corrections audit records named there, the workflow, forbidden
scanner, and diff-base resolver.

Audit findings only. Do not edit files, mutate git, run local full
`npm run check`, use Chrome or Cloudflare, deploy, publish, or expose secrets,
Room identifiers, account data, raw frames, request bodies, or raw log JSON.
Read-only `gh run view` for run `32468035902` and local read-only git/hash
commands are authorized.

## Required audit

1. Confirm local candidate HEAD and `origin/main` are exactly the recorded SHA,
   tracked bytes are clean, and the only additions are this brief and record.
2. Independently inspect the run/job/step JSON and filtered job log. Require the
   exact HEAD, successful full-check step and resolver, exact Core/DOM counts,
   build assets and total duration, and failure only at ownership. Require Pages
   configure/upload and deploy skipped.
3. Extract every ownership path in emitted order. Require exactly four
   `NEEDS-REAUTH`, then four `FORBIDDEN`, no ninth path, and byte-for-byte match
   all recorded SHA-256 values against candidate HEAD.
4. Confirm the two named independent audit identities, fingerprints, records,
   and zero findings remain applicable to the exact candidate scopes and commit
   trailers. The CI record must not overclaim Pages, Worker, browser evidence,
   or shipment.
5. Prove the proposed next commit contains only these two research metadata
   files, does not intersect any candidate changed path, and cannot modify
   product semantics or forbidden policy. Run local parent-only forbidden and
   diff checks; do not rerun the full check.
6. Scan both metadata files for credentials, capability material, account data,
   private keys, raw JSON, and accidental production identifiers.

Report `BLOCKER n / HIGH n / MEDIUM n / LOW n`. Approve
`O4P-06F-PRODUCTION-CORRECTIONS-CI-REAUTHORIZATION-APPROVED` only with every
count zero. This is ownership reauthorization only, not production evidence or
ship approval.
