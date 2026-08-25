# O4P-09B context-free cold audit brief

Date: 2026-08-25
Base SHA: `ce06a17b123cb6684090b48f9350df085e98ec54`
Risk: R3 / STANDARD
Audited candidate fingerprint:
`52e6d37e560d3aa9e308ae66ccb2eec18304a87c48881931ba6f276ac96297c3`
Semantic commit: recorded later in terminal ledger evidence by the Judge

Audit only the fingerprinted frozen O4P-09B candidate supplied with this
brief. Read `AGENTS.md`, the development workflow, the O4P-09B contract and
acceptance brief, changed source/tests, and the Judge review. Do not read
implementer rationale. Do not edit, stage, commit, push, deploy, access secrets
or network, or run the full `npm run check`.

Adversarially verify:

- the exact versioned intent contains only command ID, base revision, and the
  validated Core command, with authority/capability outside the intent;
- hostile descriptors, symbols, non-enumerable/surplus fields, invalid
  relations, and invalid Core commands fail before adapter execution;
- there is one shared application entrypoint and one exact existing protocol
  envelope, with no duplicate command compiler, reducer, or Core executor;
- Local invokes the shipped variable protocol handler once, commits only its
  returned state, projects through the shipped v3 projector, and leaks no
  private authority state;
- Remote invokes only the injected submit port, performs no optimistic/Core/
  projection mutation, validates receipt/projection identity and revision, and
  redacts raw transport failures;
- accepted, duplicate, stale, and command-ID reuse semantics remain aligned;
  identical starting state and intent produce equal Local/Remote exchanges;
- outputs contain no capability, request digest, internal receipt collection,
  Core root, raw private error, or audience-inappropriate projection data;
- no GameScreen/controller/store, Browser/runtime, Core/Protocol/Projection
  semantics, dependencies, CR, or O4P-09C-J work entered the candidate;
- the Judge-only O4P-09A history guard now compares its declared base to the
  immutable final O4P-09A candidate `3fb115b58260bebbea6911642616bc8a863ef95c`
  instead of the live B worktree, without changing A's allowlist or assertions;
- changed paths match the frozen boundary and protected tests were not weakened.

Run bounded architecture/application/Protocol/Projection evidence, affected
ESLint, TypeScript, `check:docs`, `check:forbidden -- --diff <base>`, secret
pattern scanning, and `git diff --check`. Return findings only with
BLOCKER/HIGH/MEDIUM/LOW counts and candidate fingerprint. Use
`AUDIT-OK-PENDING-FULL-CHECK` only when BLOCKER/HIGH are zero.

## Audit finding wave 1

The fresh-context auditor rejected candidate
`fbce16fad0875fd15590613703403ba0f0583df78cd693605632b4a5d699faca`
with HIGH 1. The Remote exchange validator accepted a protocol-impossible
rejection receipt combining `STALE_REVISION`, `duplicate: true`, and
`resyncRequired: false`. The bounded correction must enforce the shipped
variable-protocol relations: reject receipts are never duplicates; stale
revision is the only rejection that requires resynchronization and must require
it; a stale receipt's base revision differs from the current authoritative
revision; a non-duplicate ACK is the newly accepted head rather than an older
revision. Add hostile Remote-output evidence and do not change Protocol, Core,
Projection, UI, or the intent/application boundary.
