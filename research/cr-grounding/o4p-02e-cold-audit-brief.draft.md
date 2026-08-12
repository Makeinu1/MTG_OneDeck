# O4P-02E cold audit brief

Role: independent cold auditor. Read-only. Do not edit any file and do not
perform git writes.

Milestone: `O4P-02E` local four-client plus Table headless room gate

Base SHA: `19bb9cbe6b1792d6ba0aad6960d7c539c472df0b`

Frozen authority:

- `research/cr-grounding/o4p-02e-local-headless-room-gate.contract.draft.md`
- `research/cr-grounding/o4p-02e-acceptance-brief.draft.md`
- shipped O4P-01N/O4P-02A Core closure/parity public surface;
- shipped O4P-02B Room, O4P-02C protocol, and O4P-02D projection public
  surfaces.

Candidate production is `src/online/headless/**` excluding judge-owned
`review.*` and fixture evidence. Judge integration is the exact evidence paths
listed by the acceptance brief plus package, machine-check, TypeScript, domain,
and architecture registrations.

## Required adversarial audit

Independently inspect every contract and acceptance clause. At minimum falsify:

1. exact input/action/report/barrel schemas, five-client order/set/capability
   relations, fresh active revision-zero starting state, and exact DEFER tuple;
2. getters, accessor descriptors, Proxy traps/coercion, symbols,
   non-enumerable/unknown properties, non-ordinary prototypes, sparse or
   property-bearing arrays, invalid nested state/command/context, and input
   mutation/freeze/identity bugs;
3. vacuous coverage, forged counts/flags, accepted report without all five
   hello/projection witnesses, normal accept/reject, Table role rejection,
   stale+resync, exact duplicate, both reconnects, privacy, and replay;
4. authority bypass: direct Core reducer, fabricated ACK/revision/receipt,
   replaced protocol state, replay result used as authority, Room mutation
   outside the public disconnect operation, or more than one handler call per
   action;
5. duplicate/stale/reject edge relations, command-ID reuse mismatch, stale
   response without resync, duplicate receipt growth, revision drift, accepted
   command omission/double replay, reorder, and final digest mismatch;
6. Player and Table disconnect/rejoin atomicity, false rejoin counting, seat/
   role/outcome/Core/revision/receipt drift, disconnected final client, and
   Table treated as a Core Player or seat capability;
7. capability substring or hidden sentinel in all validation/error/response/
   log/report paths, capability-shaped unknown keys/paths, nested thrown
   messages, projection aggregation, receipts/digests/commands in reports, and
   failed privacy scan after an already-mutated state;
8. report validator relation holes, reordered clients, wrong Core-player role,
   false presence, impossible counts/revision, false coverage, extra private
   surface, malformed literals/integers, and non-fresh/non-frozen output;
9. architecture aliases/namespaces/dynamic imports, direct or indirect reducer
   access, reverse dependencies, root Online barrel, network/UI/storage/timer/
   RNG/logging side effects, dependency/version/Solo changes, and scope drift
   into O4P-03;
10. fixture/verifier non-vacuity and capability safety plus regression of Core
    closure, Solo parity, Room, protocol, and projection evidence.

Run targeted evidence only before verdict; do not run the final full
`npm run check`. Recompute and report exact semantic and context fingerprints,
context health, base/HEAD, and BLOCKER/HIGH/MEDIUM/LOW totals. Return
`AUDIT-CLEAR` only with BLOCKER/HIGH 0; otherwise return
`AUDIT-FIX-REQUIRED` with reproducible minimal findings.
