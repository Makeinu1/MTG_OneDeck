# O4P-07A terminal repair CI reauthorization cold-audit brief

Date: 2026-08-22
Role: read-only ownership-reauthorization auditor

Audit only:

- `research/cr-grounding/o4p-07a-terminal-full-check-repair-ci-reauthorization-record-2026-08-22.draft.md`;
- this brief;
- the append-only CI entry in
  `research/cr-grounding/archive/o4p-07a-completion-packet-2026-08-22.md`;
- immutable candidate HEAD `4824e01dbcfdf7e5b7618379370b6f740e0dd7ce`,
  its parent `c2a22caa84ab477f79188c5f6848e6a6c4279460`, and Actions
  `32569165758`.

Verify the exact-head full check passed with Core 227/2,093, DOM 330 files and
2,236 passed + 1 skipped, total 726,085 ms, exact built asset names, and exact
parent diff-base. Recompute the four candidate path hashes and confirm the
classifier result is exactly two research `NEEDS-REAUTH` plus two review
`FORBIDDEN` paths. Confirm the staged reauthorization candidate is exactly the
three metadata paths above, makes no Pages success claim for the skipped
deploy, does not change candidate or review bytes, and does not start O4P-07B.

Do not edit, commit, push, deploy, run full `npm run check`, or perform product
work. Return BLOCKER/HIGH/MEDIUM/LOW and
`O4P-07A-TERMINAL-REPAIR-CI-REAUTHORIZATION-APPROVED` only if exact.
