# O4P-06F context-free cold-audit brief

Base HEAD: `8810ed2e6db69fdc93c131f6abc195af6a763066`

Candidate semantic tree fingerprint before this brief:
`9a51ca8aca9b1458557847feccc548654b94ccfc118b7cd0f36fad7e6af60d13`

Role: findings-only context-free Luna xhigh cold auditor. Do not edit, create a
record, stage, run full `npm run check`, launch Chrome, use the network, deploy,
or mutate git.

Read completely:

- `AGENTS.md` and the governed development skill/references;
- `docs/judge-protocol.md`;
- `research/cr-grounding/o4p-06f-four-browser-production-release.contract.draft.md`;
- `research/cr-grounding/o4p-06f-acceptance-brief.draft.md`;
- `research/cr-grounding/o4p-06f-implementation-brief.draft.md`;
- `src/test/architecture/review.o4p-06f-four-browser-production-release.test.ts`;
- the exact staged harness, ordinary test, tsconfig, and package command.

Audit the exact staged candidate against base. Confirm only the contract's
evidence-only paths changed; dependencies, lockfile, product, Worker, protocol,
UI, Wrangler, workflow, version, manifest, generated files, and ledger are
unchanged. Recompute the stated semantic fingerprint and verify no unstaged
change exists.

Adversarially inspect and, with injected ordinary probes where useful, require:

1. exactly four distinct `Target.createBrowserContext` contexts and no tabs,
   jsdom, mocks, or Node-owned participant traffic accepted as production;
2. exact Pages/Worker origins, public Online controls, real deck bytes/hashes,
   browser-origin CORS traffic, start-with-table, four ordered draw ACKs,
   reconnect/resync, exit, status revision/count 5, and audience secrecy;
3. all runtime capabilities, including every seat capability returned by each
   claim, are included in whole-token and every contiguous eight-unit fragment
   scans for every frame, projection, summary key/value, error, and output;
4. the CLI has no fabricated/default-success deployment or platform evidence:
   absent operator barrier/tail evidence must fail closed, distinct real version
   IDs and recovery facts must be externally supplied and validated, and the
   harness cannot proceed to post-deploy assertions before that barrier;
5. reconnect evidence counts the actual protocol resync/snapshot path exactly,
   cannot consume an initial snapshot and then claim one, cannot ignore stale or
   unsolicited frames, and uses a genuinely fresh P2 socket;
6. public asset hashes/statuses are measured, nonempty, exact, and tied to the
   loaded Pages document rather than constants or empty placeholders;
7. cleanup results are measured after attempted socket/target/context/browser/
   profile cleanup, cleanup failure rejects, and no hard-coded success count or
   pre-cleanup summary can produce a false green;
8. all CDP commands, endpoint polling, page loads, browser fetch/body parsing,
   WebSocket messages, operator barriers, and cleanup are bounded and reject on
   malformed/accessor/symbol/sparse/oversized/cyclic/unexpected values without
   invoking hostile code;
9. projection canonicalization is descriptor-safe and exact enough that
   accessors, prototypes, noncanonical arrays/numbers, aliases, or omitted
   audience state cannot forge equal pre/post hashes; and
10. the summary validator is closed and deeply frozen, validates every nested
    field/relation/count/hash/version/status (not only selected fields), rejects
    capability-like or fragmented secrets, and cannot accept fake deck facts,
    console warnings, empty assets, false cleanup, or inconsistent version sets.

Run only bounded ordinary/Judge reviews, affected TypeScript/ESLint/docs/diff,
predecessor spot checks, and hostile injected probes. Report concrete findings
with severity, reproduction and smallest bounded correction. Return
`AUDIT-OK-PENDING-FULL-CHECK` only with BLOCKER/HIGH zero on the exact audited
fingerprint.
