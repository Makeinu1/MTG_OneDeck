# O4P-06B Target-Lane Correction 2

Date: 2026-08-21
Authority: active Judge
Base SHA: `a0c33741f5a2bde35f5e9a621671f5908a6b1284`

Judge reproduction found that `inspectGraphForConfiguredCapability` rejects a
configured capability only when the complete literal is present. An otherwise
valid `table-token-create` command can therefore place an eight-character
substring of a configured seat capability in its synthetic definition. The
accepted Core root and participant/table projections then retain that fragment,
contradicting the frozen O4P-06B secrecy acceptance.

Correction 2 reauthorizes only `src/online/protocol/support.ts`,
`src/online/protocol/command.ts`, and ordinary Protocol tests to reject any
configured capability substring of length eight or greater during the existing
pre-Core graph inspection. The scan must cover string values and property keys,
remain descriptor-safe and cycle-fail-closed, and must not return the matched
literal. Full capabilities continue to be rejected. No schema, response,
receipt, revision, state serialization, Cloudflare, Room, Projection, version,
dependency, `review.*`, governance, ledger, or git change is authorized.
