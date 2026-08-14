# O4P-04C Judge surgery 1

Milestone: `O4P-04C`

Owner: Sol Judge after the two implementer correction returns were exhausted

Audit authority: `/root/o4p04c_cold_auditor_retry`

Initial audit fingerprint:
`49e1bc84c1f6a21361a06495e26f2c9d4634d61df13808f82ee7a5068a5f55bf`

## Sustained HIGH findings

- `O4P-04C-HIGH-001`: a bearer or bearer fragment could be copied into
  `commandId` and Core decision context.
- `O4P-04C-HIGH-002`: the original session record could not prove that a
  participant/Core player was a validated Player seat rather than a Table or
  observer identity.

## Bounded repair

1. Require the session to include the current Player projection. Validate it
   through the shipped Projection validator and Personal Workbench builder, and
   require exact protocol/Room/participant/Core-player/revision agreement
   before any outbound frame is returned.
2. Reject any command ID containing an eight-or-more-character fragment of the
   bound bearer before constructing the Core command.
3. Add Judge review probes for full/partial bearer collision on both command
   families and a Table/observer session attempting a Player priority pass.

No Projection, Room, protocol, Core, Cloudflare, UI, focus, transport execution,
dependency, config, version, or deferred behavior changes. Re-run all
invalidated targeted/domain evidence, freeze a new fingerprint, and return the
complete candidate to the same independent auditor before any release full
check.
