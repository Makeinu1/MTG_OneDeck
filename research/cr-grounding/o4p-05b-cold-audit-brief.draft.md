# O4P-05B cold audit brief

Audit only. Do not edit files.

Milestone: `O4P-05B`

Base SHA: `76da2a67743d4e54f9ef6008ca86373963c965fe`

Read the frozen contract and acceptance brief, then inspect only the frozen
candidate tree and targeted evidence. Do not receive implementation rationale.

Required adversarial checks:

1. exact four active Players plus one Table, four Commander identities, and at
   least one accepted unique command from each Player;
2. command-id/receipt correlation excludes rejection and duplicates while
   preserving protocol order;
3. exact final Core state plus exact event transcript replay after JSON round
   trip; omission/reorder/substitution/duplicate/final-state drift turns red;
4. exact `PUBLIC_RELEASE_RULESET_V1` and shared
   `CURRENT_CONTRACT_VERSIONS` identity, no copy/env/remote/fallback/version
   drift;
5. five fresh projections at one final revision and exact 4/4/1/4
   Workbench/Guided/Table/Pairing view counts with three opponents each;
6. no capability fragment, authorization, or cross-audience private card
   identity/Oracle text in serialized projection/view evidence, and no new
   product/network report surface;
7. caller mutation, accepted-command authority drift, nondeterminism, and
   non-frozen output probes turn red while shipped validator adversarial tests
   remain unchanged;
8. no Core/Room/Protocol/Projection/UI semantic edits, React/CSS, Store,
   package/dependency, script/workflow, Cloudflare, or version drift;
9. no skipped/deleted/weakened assertion, production source, or public barrel
   broadening;
10. unsupported compound behavior remains visibly guided/manual and 05C/05D
    gates remain deferred.

Return findings only with BLOCKER/HIGH/MEDIUM/LOW totals and either
`AUDIT-OK-PENDING-FULL-CHECK` or rejection.
