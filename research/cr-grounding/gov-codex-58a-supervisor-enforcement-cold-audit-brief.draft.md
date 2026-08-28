# GOV-CODEX-58A Cold Audit Brief

Read only. Do not edit, commit, push, deploy, publish, or run the release full
check.

Authority:

- Contract:
  `research/cr-grounding/gov-codex-58a-supervisor-enforcement.contract.draft.md`
- Acceptance:
  `research/cr-grounding/gov-codex-58a-supervisor-enforcement-acceptance.draft.md`
- Base SHA: `74d24c0311e0d58112b15c58d6f8546449a5b01a`
- Candidate fingerprint: freeze before dispatch.
- The frozen fingerprint is the SHA-256 of stable JSON containing
  treeFingerprint and trackedAuthorityEventHash; verify both input hashes, the
  event chain, and the derived value before findings.
- Audit class: R3 / BROAD.

Audit the frozen bytes adversarially for permission escalation, candidate
conflict bypass, counter reset, numeric approval reintroduction, audit-stop
laundering, duplicate lineage/wait bypass, incomplete guard impact, false-green
acknowledgement, preflight disagreement, terminal-lane regression, product/CR
scope leakage, and tests that only assert prose rather than behavior.

Also reproduce the former long-running bootstrap race: a live action must
derive its receipt inside the transition, retain that action-boundary prefix
through guard work, and append a new receipt on the next action. Confirm that
caller-selected stale prefixes still fail and historical valid prefixes do not
become false-red merely because the JSONL later grew.

Mutate the post-bootstrap receipt plan with a shifted baseline, swapped role,
different session, omission, and addition. Confirm the first tracked event's
baseline and ordered session-role plan are the sole canonical authority and
every mismatch fails without event or loop mutation.

Drive the canonical `runProgramStep` path from `require-repair` through
`derive-repair`; confirm inherited acceptance, authority, cumulative counters,
and hash-chain append. A malformed tracked chain must still fail. Also cross
the full-check/usage/correction/continuation watchdogs and confirm they remain
visible advisories without becoming permission, while duplicate role/wait and
excess push structural limits remain nonzero. Confirm that an advised later
full check still requires an actual final exact-tree green result before
commit or release.

Adversarially mutate repository bytes after tracked bootstrap. Confirm ordinary
actions stop, `refresh-fingerprint` requires the supervisor plus exact owner and
guard evidence, acceptance/authority drift cannot be refreshed, the old event
prefix remains intact, and canonical context stays below 12 KiB afterward.

Return findings only, counted as BLOCKER/HIGH/MEDIUM/LOW. Return
`GOV-CODEX-58A-AUDIT-OK` only when all four counts are zero on the exact
fingerprint.
