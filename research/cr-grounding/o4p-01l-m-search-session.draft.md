# O4P-01L-M Search Session draft

Status: implemented-not-audited; serial Search Session lane M.

This lane adds the mode-neutral Search Portion, Criteria, Session, and Slice
contracts plus strict validation and the open/complete/cancel operations.

The operation is a selection-only substrate: opening snapshots the requested
zone portion in current order, completion checks unique candidate membership,
quantity/qualified bounds, and the unchanged snapshot, then removes the
session. It returns selected IDs in snapshot order and `revealFound` /
`shuffleAfter` metadata. It does not move objects, reveal, shuffle, emit an
event, or generate a command. `criteriaKey` is opaque and is not evaluated.

The registry/player overload is a narrow fixture adapter and returns a slice;
the canonical overload is `open(bundle, sessionKey, input)` and corresponding
bundle completion/cancellation. No barrel, bundle, ledger, review test, or
production integration is changed in this lane.
