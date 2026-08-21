# O4P-06E cold audit brief

- Milestone: `O4P-06E`
- Base: `affb28de31ab562238b74199d0469a5bacef3d73`
- Profile: BROAD, context-free, findings only
- Required reading: `AGENTS.md`, the development skill/governance,
  `docs/judge-protocol.md`, the O4P-06E contract, acceptance brief, local
  browser evidence, and this brief

Audit the frozen staged candidate without edits, git mutations, full check,
network writes, publication, or implementer rationale. Verify the exact staged
scope and canonical fingerprint before relying on tests.

Adversarially verify at least:

- Solo default inertness, active-Solo preservation, leave/unmount teardown,
  poll/fetch/socket epoch fencing, and late callback behavior;
- fixed HTTPS/WSS origin and exact route/body matrix, including legacy create
  and start compatibility and no capability in URL/history/storage/log/error;
- descriptor-safe, exact-key, dense/bounded validation for create/claim/lobby
  responses, UTF-8/oversize/accessor/symbol/prototype/cycle/sparse inputs,
  unsafe IDs, cross-Room identity, participant/host/seat mismatch, capability
  collision, and capability fragments in values or property keys;
- create double-submit, stale responses, join invite clearing, failed
  initialize retry, and start-with-table atomicity;
- equality of the legacy four-deck Core root, exactly four Player participants
  plus one unseated Table participant, exactly one observer authorization,
  credential separation, and serialized protocol size closure;
- Player/Table Browser client construction, host two-client readiness, exact
  revision/Room pairing, non-host projection scope, no optimistic authority,
  64-entry outbox inheritance, generic failures, and manual actions never sent;
- DOM/attribute/React-key/clipboard exposure, Japanese fixed error text,
  native control/disabled/focus semantics, 44px targets, responsive overflow,
  and the recorded local browser evidence;
- write boundary, architecture imports, Solo storage bytes, dependency/version/
  schema/Worker configuration/generated-doc/ledger absence, and all O4P-06F
  production/four-browser/replay claims remaining deferred.

Independently rerun the O4P-06E Judge/ordinary/architecture tests, relevant
Solo and predecessor Lobby/Cloudflare/Browser/Projection reviews, affected
verifiers, TypeScript, affected ESLint, docs/generator checks, and diff checks.
The generator must be current. `check:docs` is expected at this pre-commit
boundary to report only `CONTRACT-ENGINE-MULTIPLAYER` stale because the staged
Judge-owned `soloOnlineBoundary` registration cannot be named by an ancestral
`lastVerifiedCommit` until the audited candidate commit exists; independently
verify this is the sole docs failure and report it as the bounded post-audit
manifest-reanchor gate, not as product acceptance.
`check:forbidden` may report the expected Judge-owned draft/review ownership
boundary; classify any unexpected implementation path separately.

Report BLOCKER/HIGH/MEDIUM/LOW counts. Only return
`AUDIT-OK-PENDING-FULL-CHECK` if all counts are zero on the exact fingerprint.
