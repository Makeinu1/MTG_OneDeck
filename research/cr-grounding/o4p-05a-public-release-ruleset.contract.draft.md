# O4P-05A Public Release Ruleset contract

Date: 2026-08-15

Milestone: `O4P-05A`

Base SHA: `17965786dba01a15770e19437b9456ca81c0f18b`

Status: frozen judge-owned candidate contract

Risk: R3 public release authority and version identity; no CR semantic change

## Goal and user ruling

O4P-05A closes the deferred O4P-00B publication blocker by explicitly naming
the repository-local pinned Comprehensive Rules and the already-shipped Online
contract version vector as the MVP public release authority.

The user ruled on 2026-08-15 that this milestone must use the latest CR already
present in the repository, not refresh from Wizards. Therefore no network
lookup, download, date comparison, or replacement of the local CR is part of
this milestone. The local pin is:

- body: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`;
- metadata: `rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json`;
- ruleset ID and effective date: `mtg-cr-2026-06-19` / `2026-06-19`;
- raw-body SHA-256:
  `e99cd70eb64ca854acb6420ebbf06e369e3f258e0cfba4f03f70bd881386f79b`.

The existing `sourceUrl` remains provenance for these local bytes. It is not
an instruction to contact the network during build, test, runtime, or release.

## Public release descriptor

Add one additive public descriptor under `src/versioning`:

```text
PUBLIC_RELEASE_RULESET_SCHEMA_VERSION_V1 = 1

PUBLIC_RELEASE_RULESET_V1 = {
  kind: "mtg-onedeck-public-release-ruleset-v1",
  schemaVersion: 1,
  source: "repository-local-pin",
  contractVersions: CURRENT_CONTRACT_VERSIONS
}
```

The descriptor is a readonly V1 value, is deeply frozen, and references the
exact deeply frozen `CURRENT_CONTRACT_VERSIONS` object rather than copying or
retyping its ruleset data. The public barrel exports the schema constant,
descriptor, and named `PublicReleaseRulesetV1` type. There is no unversioned
alias, mutable builder, environment override, latest-version lookup, fallback,
or network path.

`CURRENT_CONTRACT_VERSIONS` remains exactly:

- `contractSchemaVersion = 1`;
- ruleset ID/effective date/SHA equal to the local pin above;
- engine/state/event/protocol/projection versions all `1`.

No numeric version is bumped because neither CR bytes nor engine, state,
event, protocol, projection, or contract-schema meaning changes.

## Fail-closed release evidence

The release gate must continue to execute these existing checks before the
general test/build lane:

1. `npm run verify:cr` recomputes the raw local body SHA, reads the body header,
   and validates the exact metadata and local path without network access.
2. `npm run verify:versions` requires the local metadata reference to equal the
   deeply frozen `CURRENT_CONTRACT_VERSIONS.ruleset` value.
3. Judge-owned review evidence pins the public descriptor, local bytes,
   metadata, unchanged version vector, and release-gate ordering.

Any missing file, byte drift, metadata drift, ruleset/version mismatch,
unexpected release source, mutable descriptor, or reordered/removed verifier
fails closed. A green classifier, corpus, build, or runtime scenario cannot
substitute for either ruleset verifier.

## Module and write boundary

Implementation is bounded to:

- `src/versioning/publicReleaseRuleset.ts`;
- the minimum public export edit to `src/versioning/index.ts`;
- ordinary non-`review.*` tests under `src/versioning`.

The implementer must not edit the CR body or metadata, existing version values,
verifier scripts, machine-check ordering, `review.*`, docs, governance, ledger,
loop-state, dependencies, package files, engine, Store, Solo, Online protocol,
Projection, Worker, Cloudflare configuration, UI, or git state.

## Required evidence

- Judge-owned `src/versioning/review.o4p-05a-public-release-ruleset.test.ts`.
- Focused ordinary versioning tests plus the Judge review test.
- `npm run verify:cr`, `npm run verify:versions`, scoped ESLint,
  `npx tsc -b`, and `git diff --check` before freeze.
- One independent STANDARD R3 cold audit before one fingerprint-matched
  `npm run check`.
- Exact-head CI and Pages evidence after commit/push. No visible UI changed, so
  the three-viewport UI gate is not invalidated by O4P-05A.

## Explicit DEFER / non-goals

No remote CR refresh, CR text reconciliation, rules-engine semantic change,
new GameState/GameCommand, migration, protocol negotiation, version bump,
runtime network call, room scenario, privacy/recovery/load/security gate,
Cloudflare deployment change, or production-release closure. O4P-05B owns the
four-player release scenario; O4P-05C owns operational gates; O4P-05D owns the
final MVP production release.
