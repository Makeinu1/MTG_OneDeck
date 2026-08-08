# O4P-00C version contract draft

Status: draft. This document is not an active contract.

## Confirmed scope

The online contract version vector is a typed, local-only value containing:

- contract schema version
- the pinned CR ruleset id, effective date, and raw-body SHA-256
- engine semantics version
- state schema version
- event schema version
- protocol version
- projection schema version

All numeric versions start at `1`, are JavaScript safe integers, and are not
SemVer values. The current vector is defined in `src/versioning/contractVersions.ts`.
Its CR reference is checked against the existing O4P-00A metadata by
`scripts/checks/verify-contract-versions.ts`.

`BuildId` is a separate 1–64 character ASCII identifier. It is not used for
compatibility decisions.

This milestone does not define rooms, transport, protocol negotiation,
canonical state, projections, migration, retention, or deployment behavior.
