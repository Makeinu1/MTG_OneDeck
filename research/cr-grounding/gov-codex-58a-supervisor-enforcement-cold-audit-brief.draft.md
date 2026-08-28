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
excess initial semantic push remain nonzero. Cross the replacement-push
objective twice and confirm the counter remains cumulative and advisory only,
while every replacement still requires explicit push authority plus the
same-acceptance audit/full-check/commit path. Confirm that an advised later full
check still requires an actual final exact-tree green result before commit or
release.

Adversarially mutate repository bytes after tracked bootstrap. Confirm ordinary
actions stop, `refresh-fingerprint` requires the supervisor plus exact owner and
guard evidence, acceptance/authority drift cannot be refreshed, the old event
prefix remains intact, and canonical context stays below 12 KiB afterward.

Run the default forbidden-file scan from a clean committed release checkout
whose diff contains Judge-owned `review.*` and research paths. It may pass only
by recovering the exact active tracked authority and recomputing an equivalent
guard acknowledgement; it must accept no caller owner, allowlist, manifest, or
acknowledgement. Mutate an acknowledged path or owner, base/current hash,
candidate/tree identity, semantic guard or predecessor ID, wildcard, authority
chain/domain, or add another supervisor event path; every case must remain red.
Confirm the ordinary non-supervised and governance-reset boundaries are
unchanged.

Create an actual semantic git commit in a temporary repository. Confirm the
declared base remains immutable, the only pre-bind post-commit exception is an
ancestor/exact-tree/semantic-clean `push-ready` candidate, push recording binds
the current commit once as `releaseHeadSha`, and CI/deploy/ship reject a
different HEAD including a same-tree metadata commit. Exercise a post-commit
repair and confirm the new candidate uses the current HEAD as its base without
changing acceptance, authority, counters, roles, or waits.

Create a clean checkout with no ignored loop-state file. Confirm context
recovers the exact latest candidate only from the tracked authority at HEAD,
verifies its event/receipt/counter/state chain offline, and returns a compact
green projection. Repeat with dirty, absent, corrupt, rewritten, and
HEAD-mismatched authority; all must fail. Confirm that a checkout with an
existing loop-state record still uses live receipt verification and cannot be
laundered through the offline recovery path. Rehash the complete authority
chain after separately corrupting an earlier candidate's required shape, an
incomplete STOP record, and state-specific evidence. Each must still fail from
the clean-checkout path, including when the latest candidate remains valid.

Audit the terminal authority append independently. Only the exact active-domain
path may leave the semantic fingerprint; HEAD events must be a strict immutable
prefix and appended sequence/hash/receipt-plan/actor/usage/counter/state/scope/
lineage/wait/ledger evidence must validate offline. Confirm the terminal
fingerprint binds the exact path and latest event hash. Test truncation,
rewrite, damaged hash or receipt, another domain, extra paths, and an existing
HEAD authority beyond the bounded reader size; none may be treated as a missing
predecessor or a terminal green.

Reproduce the workflow's real terminal CI shape: commit the audited/deployed
semantic release head `S`, bind `releaseHeadSha=S`, then commit only the
verified authority/ledger/loop terminal successor `T`. The terminal verifier
must accept `base=S, head=T` without rebinding the release head, and must reject
a different release base, semantic bytes in `T`, or any extra path. This narrow
R0 successor must not weaken the live same-tree-different-HEAD rejection before
CI, deploy, and ship.

Mutate a later receipt while recomputing its outer event hash. A shorter prefix
for the same session and a different SHA-256 at the same byte length must both
fail offline and must not enter the terminal lane. Separately confirm that a
truly absent predecessor uses the missing code while probe execution,
permission, object-integrity, oversized, malformed, and read failures use an
explicit integrity/read-failure code.

Return findings only, counted as BLOCKER/HIGH/MEDIUM/LOW. Return
`GOV-CODEX-58A-AUDIT-OK` only when all four counts are zero on the exact
fingerprint.
