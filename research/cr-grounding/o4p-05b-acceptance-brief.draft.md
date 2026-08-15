# O4P-05B acceptance brief

Base SHA: `76da2a67743d4e54f9ef6008ca86373963c965fe`

Contract:
`research/cr-grounding/o4p-05b-four-player-release-scenario.contract.draft.md`

## Required acceptance

1. The Judge review builds a fresh, deeply frozen canonical Headless input
   without network/storage/clock/random/environment/DOM access and passes the
   shipped exact validator.
2. Existing validator red probes for unknown/accessor/symbol/sparse/capability
   hostile data remain green and are not duplicated or weakened by O4P-05B.
3. The scenario contains exactly four active Players plus one Table, four
   distinct Commander identities, at least four accepted unique commands, and
   at least one accepted command from every Player.
4. Rejected, stale, role-rejected, and duplicate commands remain outside replay
   authority; accepted commands preserve protocol order.
5. Protocol final Core digest, closure final-state digest, replay final-state
   digest, closure event digest, and replay event digest match as required.
   JSON-round-trip replay succeeds.
6. Exact omission, reordering, substitution, duplicate insertion, bad actor,
   bad base revision, receipt drift, or final-state drift fails closed.
7. The review reuses `PUBLIC_RELEASE_RULESET_V1` and its exact
   `CURRENT_CONTRACT_VERSIONS` reference. Source/id/version drift, copied
   vectors, env fallback, and remote lookup fail review.
8. The same final revision produces 4 Personal Workbench, 4 Guided Actions,
   1 Table Display, and 4 Display Pairing views; every pairing has exactly
   three opponents and exact player/seat coverage.
9. Serialized projections/views contain no capability fragment, observer
   authorization, or cross-audience private identity/Oracle text; no new
   report is exposed to product/network code.
10. Repeated JSON-equivalent executions produce identical final-state/event
    digests, caller input is unchanged, and returned graphs are deeply frozen.
11. The single Judge review asserts final state/event evidence, ruleset
    identity, privacy, exact no-new-public-surface boundary, and non-goals.
12. No existing version constant, Core/Room/Protocol/Projection/UI semantics,
    React/CSS, package dependency, Cloudflare runtime, or deployment file drifts.

Any missing executable final-state or event evidence leaves the scenario
guided/manual and blocks release claims.
