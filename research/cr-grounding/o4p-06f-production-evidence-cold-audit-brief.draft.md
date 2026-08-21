# O4P-06F production evidence cold-audit brief

Date: 2026-08-21
Milestone: `O4P-06F`
Candidate HEAD: `0f8957486af558b503d42c3d66e2e4563f2734ef`
Evidence record:
`research/cr-grounding/archive/o4p-06f-production-evidence-record-2026-08-21.md`
Risk: R3 production release evidence closure

## Role and scope

You are a context-free Luna xhigh cold auditor. Findings only: do not edit,
stage, commit, push, deploy, delete resources, change secrets, run a local full
check, or publish. Read this brief first, then the evidence record, governing
O4P-06F contract/acceptance, correction-3 authority/audit record, exact harness,
and only directly required Worker/protocol sources.

The staged candidate may add only this brief and the production evidence
record on top of clean candidate HEAD. Product/harness/test/review/Worker,
package/lock/dependency, Wrangler, workflow, docs/generated, manifest, ledger,
version, and prior audit bytes must be unchanged.

## Private read-only evidence inputs

The following local temporary files are evidence inputs, not commit material:

- `/private/tmp/o4p06f-formal-summary.json`;
- `/private/tmp/o4p06f-formal-tail.jsonl`;
- `/private/tmp/o4p06f-formal-harness.raw`;
- `/private/tmp/o4p06f-formal-final-status.json`;
- `/private/tmp/o4p06f-versions.json`;
- `/private/tmp/o4p06f-deployment-status.json`;
- `/private/tmp/o4p06f-c3-pages-index.html` and its headers file.

Tail/harness/status files can contain the ephemeral Room correlation value.
Inspect them only through a local parser. Never print, quote, copy, report, or
commit that value, capabilities, participant IDs, raw JSON, or raw frames.

## Required audit

1. Verify HEAD/origin equality, clean tracked bytes, exact two-file staged
   metadata boundary, and no overlap with product/audited source since HEAD.
2. Recompute the evidence summary SHA-256 and run the exported closed validator.
   Reject extra/missing/sparse/accessor/proxy values and any secret-like string.
3. Recompute all four deck byte counts and SHA-256 values from repository bytes.
4. Privately correlate the summary Room to tail and final status. Require one
   matching post-version recovery fact at checkpoint 0/current 5/replay 5/ok,
   no error/exception/parse/secret violation, and final HTTP status revision and
   accepted count 5. Do not expose the correlation value.
5. Verify distinct valid pre/post versions, final active post version at 100%,
   retained pre version, fixed Wrangler 4.122.0, expected Worker origin and only
   the two declared bindings. No rollback or configuration expansion.
6. Verify run `32473802443` exact head, successful full check/resolver/
   ownership/build/artifact/deploy, recorded Core/DOM totals, and Pages HTML,
   exact JS/CSS names, HTTP 200, Last-Modified, and recorded content hashes.
7. Verify exact 4 contexts, seven HTTP 200 values, action counts 4/1, fresh P2
   stale resync with one snapshot, revision/count 5, all four projection hash
   pairs equal, recovery facts exact, console zero, and measured cleanup.
8. Verify Worker root and safe probe are 404, same-Room status is 200 after
   cleanup, no Chrome/harness/tail process remains, HEAD equals origin/main, and
   worktree differs only by the two staged metadata files.
9. Scan both metadata files for Room/participant/capability/credential/account/
   token/private-key material, raw JSON, unredacted tail, false success from the
   discarded first attempt, or claims outside O4P-06F.

Use read-only `gh`, `curl`, pinned Wrangler status/version commands, and local
parsers only as needed. If sandboxed tsx/CLI IPC fails, record the environment
caveat and use an equivalent read-only invocation; do not weaken assertions.

Return exact BLOCKER/HIGH/MEDIUM/LOW counts. Only with all zero may you issue
`O4P-06F-PRODUCTION-EVIDENCE-APPROVED`, which authorizes terminal metadata and
ledger promotion only; it is not itself shipment or permission for a further
Worker deployment.
