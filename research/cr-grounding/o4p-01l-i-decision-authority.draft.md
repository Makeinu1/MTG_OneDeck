# O4P-01L Wave 2B-I — Decision Authority

Status: `implemented-not-audited` (implementation-lane draft; not judge-approved or shipped)

Base: `FOUNDATION_SHA=2e10829`

This lane implements the additive Decision Authority slice in
`src/engine/core/rules/decisionAuthorityV1.ts`. It validates exact authority
order/key sets and closed scope variants, returns fresh deep-frozen values,
resolves last-applicable matching authorities, activates pending authorities
for the supplied actual turn, and expires matching active-turn authorities.

Deferred: Bundle integration/export wiring, player exit, tournament choices,
outside-game information, command/event generation, combat, and release/audit
evidence remain outside this implementation lane.
