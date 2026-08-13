# O4P-03C bounded Sol Judge surgery

Milestone: `O4P-03C`

Base SHA: `a6f4c539a977e38a6891c31fb99acf4fddfee428`

The two Luna implementer correction returns are exhausted. Independent
correction re-audit at semantic fingerprint
`5290b41682de753aaedfde344d83af0b827c47cd3d25aff299f8b33da0d2f40c`
returned BLOCKER 1 / HIGH 3. Under the standing bounded-surgery rule, Sol owns
this final narrowly-scoped repair and returns it to the same independent cold
auditor before any release full check.

## Accepted findings and exact repair boundary

1. Retain rotated network tokens in a canonical, bounded ledger inside the same
   private grant row until a later accepted rotation prunes expired entries.
   Cap it at 256; reject unexpired reuse and exact collisions.
   The reuse check applies after evaluating original expiry at the accepted
   action clock, so an expired retired value may be reused while the current
   token remains valid.
   Configured protocol capabilities remain in protocol state and are not
   duplicated. Remove the bearer-shape heuristic so valid lower IDs remain
   valid. Scan hostile property names and values; the fixed
   `participantCapability` schema label and only its root transport value are
   exempt from collision scanning.
2. Store and validate the initialized grant count in the security singleton so
   an exhausted-window path can reject incomplete security state without
   loading Room/journal state and without any write.
3. Canonically require `CAPABILITY_ROTATED` iff audit outcome is `accepted`, all
   other audit outcomes are `rejected`, and a participant audit generation is
   not in the future relative to its current grant.
4. Add Judge evidence for the exact two-rotation previous-token reproduction,
   a valid long lower identifier, incomplete grant cardinality, impossible
   audit relations, and atomic SQL behavior. Update frozen successor/verifier
   hashes only after these assertions pass.

No dependency, version, `wrangler.jsonc`, lower layer, deployment, migration,
secret, route, UI, Pages, or external Cloudflare work is authorized. The
release `npm run check` remains forbidden until the independent repaired-tree
audit reports BLOCKER/HIGH 0.
