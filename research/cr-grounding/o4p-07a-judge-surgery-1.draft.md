# O4P-07A Judge Surgery 1

Date: 2026-08-22
Base SHA: `55fe011700bd6bb10a699e1bd431f0bf12cc40cb`
Audited candidate fingerprint:
`8954729c0b0c5f6257651484e2e61af3ed53c22886012184584f9a7d75e70407`
Auditor: `/root/o4p07a_luna_cold_auditor` (`gpt-5.6-luna`, xhigh,
fresh-context, read-only, R3/BROAD)

## Accepted findings

The initial audit returned BLOCKER 0 / HIGH 4 / MEDIUM 3 / LOW 0:

1. a v1 replacement did not advance the v2 CAS revision, so an older in-flight
   resolver could restore an accepted v2 snapshot;
2. digest-consistent snapshots accepted malformed optional `CardDef` fields;
3. v2 submission could mutate a `started` lobby back to `forming`;
4. malformed optional Scryfall fields were silently sanitized;
5. noncanonical but digest-consistent history JSON was accepted;
6. persisted issue indices were not bounded by the submitted entry count;
7. history/head invalidation updates lacked exact-one `RETURNING` checks.

## Bounded correction

- v1 invalidation advances the head/history revision atomically, uses exact-one
  CAS, clears the snapshot, and old same-submission completions become
  write-free `STALE_RESOLUTION` results;
- v2 rejects `started` before parsing, resolving, or persistence;
- snapshot decode validates every optional array, union, number, and face
  string field;
- production Scryfall mapping rejects wrong-typed optional fields while still
  mapping any valid non-Japanese language string to the existing English
  `CardDef` representation and preserving the contracted
  `oracle_id ?? id` nullish fallback;
- history requires exact canonical bytes and entry-bounded private issues;
- every history/head replacement update requires one exact `RETURNING` row;
- Judge adversarial tests reproduce all seven original failures and their
  fail-closed outcomes.

No UI, start/genesis, fixed catalog, dependency, configuration, deployment,
ledger, or CR behavior is changed. The corrected tree requires targeted
reverification and a fresh fingerprint re-audit before the release full check.
