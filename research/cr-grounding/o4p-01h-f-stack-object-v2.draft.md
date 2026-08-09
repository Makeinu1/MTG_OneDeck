# O4P-01H-F implementation note: stack object identity V2

Status: implemented-not-integrated

The allowlisted implementation adds the three stack-only identity branches:

- `spell-copy` with a Core definition ID, seated-player-shaped controller ID,
  and canonical historical-capable `copiedFromObjectId`.
- `activated-ability` and `triggered-ability` with controller ID, nullable
  canonical historical-capable source ID, and a stable `abilityKey` using the
  Core base-ID grammar.

Factories inject their fixed discriminant, reject caller-supplied `kind`, do
not mutate input, and return deeply frozen canonical values. Validators reject
non-plain roots, symbols, accessors, non-enumerable fields, unknown fields,
missing fields, invalid discriminants, invalid IDs, and invalid ability keys;
issue lists are deterministic and complete for the structural value.

Registry membership, zone placement, runtime rows, source snapshots, object
creation, choices, priority, resolution, trigger detection, and integration
exports remain deferred per the frozen O4P-01H contract.
