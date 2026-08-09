# O4P-01G-E Fixture, Machine Gate & Audit Closure V1

Status: `implemented-not-integrated`

This draft records the candidate implementer work for the O4P-01G-E fixture,
property, verifier, and machine-check connection. It is not a formal
specification or an active contract.

The new JSON transition fixture is parsed independently and covers all seven
destination branches, top/bottom/index library placement, owner/controller
divergence, incarnation/object-id replacement, runtime reset, and atomic
invalid-input cases. The property test checks input immutability, unique source
removal, owner routing, controller assignment, validators, and no partial
update. It separately generates source-slot records, destination branches,
controller values, library placements/indices, and invalid transition records
with fast-check rather than repeating the golden cases. The fixture metadata
declares the two source basenames and raw-byte SHA-256 fingerprints; both the
property test and verifier resolve only those basenames from the fixture
directory and validate the resolved Identity/Runtime JSON before use. The
metadata also declares a validated placement seed that moves PC4:1 into the
non-empty P2 library and resets its runtime. Golden and generated property
checks derive their JSON inputs from that seed and assert distinct top,
bottom, and index library arrays, so append-only regressions are observable.
The
mode-neutral verifier also rejects malformed transition objects,
source or runtime-key residue, invalid owner/controller results, stale runtime,
and invalid library placement through fail-closed assertions.

The verifier requires the complete unique nine-case ID set, the complete seven
destination-kind set, all three library placement kinds, and explicit
owner/controller divergence for both battlefield and stack cases. Every case
shape and expected field is checked before execution.

The machine check now has ten ordered stages: pinned CR, version contract,
Solo preservation, Online architecture, Core Identity/Zone, Core Card Runtime,
Core Card Zone Transition, lint, test, and build. The existing fail-fast and
diagnostic continuation behavior remains covered by the machine-check tests.

OUT OF SCOPE: production UI, event/command/online integration, replacement
effects, commander replacement, tokens, copies, abilities, same-zone reorder,
shuffle, entry modifiers, and any change to existing Identity/Zone/Runtime
implementations or fixtures. No cold audit, ledger integration, commit, or
release publication is performed by this implementer lane.

DEFER: independent cold-audit findings and judge-owned contract/ledger closure.
