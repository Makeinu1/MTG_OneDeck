# O4P-05C bounded Judge surgery 1

Milestone: `O4P-05C`

Base SHA: `7dc41384bf6763986a47151d69f78f31021976fe`

Implementer session: `01a00367-f677-7c92-9509-ca30865ca5aa`

Requested model / effort: exact `qwen-cloud/qwen3.8-max` / `xhigh`

## Trigger

The initial Qwen packet was already bounded to one exact file,
`src/online/cloudflare/__tests__/releaseGateEvidenceV1.ts`. The implementer read
only the three frozen O4P-05C drafts, then stopped before another tool call or
file write. The recorded first turn used 60,932 total tokens and wrote zero
bytes. After bounded interruption, correction return 1 resumed the same
session with an even smaller packet containing only readonly types and frozen
constants. It again stopped before a tool call and wrote zero bytes.

No alternate model or implementer was substituted. Both returns left the
worktree byte-identical outside the Judge-authored contract files. This meets
the standing two-consecutive-failure condition for bounded Judge surgery.

## Bounded repair

The Sol Judge owns the exact O4P-05C candidate after the failed implementation
returns:

- strict test-only evidence validator and ordinary tests;
- independent `review.*` integration and architecture evidence;
- frozen verifier, package/machine-check/TypeScript registration;
- audit/release governance, git, CI, Pages, and ledger.

The surgery does not add or change Cloudflare production code, Core, Room,
protocol, projection, UI, dependency, version, configuration, CR pin, or
external resource. It preserves the frozen contract and remains subject to a
fresh independent BROAD cold audit before any release full check.
