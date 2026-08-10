# O4P-01L-N Bundle Integration draft

Status: implemented-not-audited; serial Bundle Integration lane N.

The six-field `CoreRuleAuthorityBundleV1` wraps the existing
`CoreTurnPriorityBundleV1` and keeps Registry/turn/priority state single-source.
Validation is ordered Turn Priority, Control, Decision Authority, Search
Session, Visibility, and Play Permission, followed by cross-slice checks for
seated players, present objects, continuity/controller parity, search
snapshots, and expected play zones.

Lifecycle operations are all-or-nothing and return fresh deep-frozen values.
Turn-boundary expiry removes matching Control, Visibility, and Play records,
expires active-turn Decision Authority, preserves Search Sessions, and
reconciles controller continuity against the Registry after a control effect
ends. Missing-source pruning removes only while-source-exists and
while-attached Control/Visibility/Play records; it does not infer dependency
ordering for while-source-controlled-by. Turn-start activation marks the
affected player's controlled permanents and activates pending-next-turn
Decision Authority.

This lane does not add barrel exports, commands/events, projections, network,
combat, player exit, casting legality, or UI.
