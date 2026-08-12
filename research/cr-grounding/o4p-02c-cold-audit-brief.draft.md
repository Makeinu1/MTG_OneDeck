# O4P-02C cold audit brief

Role: independent cold auditor. Read-only. Do not edit any file and do not
perform git writes.

Milestone: `O4P-02C` In-memory Protocol & Command Envelope

Base SHA: `64eb31e2ff5cd276e8bb73ea835d51a34c3b5ef1`

Frozen authority:

- `research/cr-grounding/o4p-02c-in-memory-protocol.contract.draft.md`
- `research/cr-grounding/o4p-02c-acceptance-brief.draft.md`
- shipped O4P-01N public Core closure
- shipped O4P-02B public Room
- shipped contract-version/BuildId API

Candidate implementation is `src/online/protocol/**` excluding judge-owned
`review.*` and fixture evidence. Judge integration is the exact evidence paths
listed by the acceptance brief plus their package, machine-check, TypeScript,
domain, and architecture registrations.

## Required adversarial audit

Independently inspect every contract/acceptance clause. At minimum falsify:

1. exact message/state/receipt unions, protocol version 1, valid Build ID
   mismatch as diagnostics only, and revision equal to Core accepted count;
2. generic player/observer capability authentication and capability secrecy in
   every structural, auth, Core, Room, and stored-receipt failure path;
3. player and observer reconnect changing only Room presence, never Core,
   revision, seat outcome, identity/order, or receipt history;
4. authentication-before-dedup, dedup-before-stale ordering, composite key
   scope, capability-excluded digest, exact retry single application, ID reuse
   mismatch, and deterministic stored reject replay;
5. actor-seat binding, command sequence/base revision rules, Core apply exactly
   once, accepted revision, generic Core rejection, atomic reconciliation, and
   Room finish derived only from accepted Core lifecycle;
6. metadata-only ServerHello/ACK/reject/resync, with no Core/Room/capability/
   command/digest/hidden-card leak or false projected-snapshot claim;
7. exact descriptor-safe/trap-safe/getter-free/dense-array validation,
   deterministic complete issues, deep freeze, and no trim/sort/dedup/default/
   mutation of caller input;
8. state invariant rejection for observer coverage, cross-capability reuse,
   receipt uniqueness/outcome corruption, revision drift, and Room/Core drift;
9. only public Core/Room/versioning imports, reducer only in protocol command
   handling, Room aliased reducer rejection, no reverse Core dependency, no
   store/UI/Solo/snapshot/network/Cloudflare/clock/RNG/storage contamination,
   no root Online barrel, and no shared version/dependency expansion;
10. fixture, verifier, judge review, architecture review, machine-check and
    `online-protocol` domain registration are non-vacuous/fail-closed, while
    existing O4P-01N/O4P-02A/O4P-02B evidence remains green.

The release full `npm run check` must not have run on the frozen candidate
before this audit. Treat targeted green evidence only as claims to falsify.

## Return format

- observed semantic fingerprint from `node scripts/checks/fingerprint.mjs` and
  context fingerprint/status from `npm run codex:context -- --domain O4P-02C`;
- findings sorted BLOCKER, HIGH, MEDIUM, LOW;
- stable ID, exact path/symbol, violated clause, reproduction, impact, and
  smallest safe correction for every finding;
- explicit severity totals and exact commands/outcomes;
- `AUDIT-CLEAR` only when BLOCKER/HIGH are zero; otherwise
  `AUDIT-FIX-REQUIRED`.

Do not modify source, tests, fixtures, verifier, contract, ledger, loop state,
docs, git state, or candidate fingerprint. Timeout/incomplete inspection is no
verdict.
