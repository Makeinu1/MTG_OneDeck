# O4P-01H-G implementation draft

Status: implemented-not-integrated

The additive V2 object-registry state, strict descriptor-safe registry/runtime
validators, canonicalization, and V1 identity/runtime upgrade adapters are
implemented in the seven-file allowlist. Existing V1 schemas, validators,
factories, fixtures, indexes, runtime consumers, Solo, Online, UI, package
metadata, and machine checks were not modified.

Implemented boundaries:

- V2 IDs and identity variants are reused from the preceding additive V2
  object modules; card objects retain the V1 physical-card/incarnation form.
- The single V1 zone representation is retained. Every registry object must
  occur once; token objects are battlefield-only; spell copies and abilities
  are stack-only; mixed stack order is the array order.
- Historical provenance references are accepted without current-registry
  membership. Synthetic objects do not receive card runtime rows.
- Successful validation and adapter output are fresh, canonical, and deeply
  frozen; input descriptors, semantic array order, and V1 adapter inputs are
  not mutated.

Deferred by contract: integration exports and machine gate, object creation or
  commands, priority/resolution/targets/choices, CR 707 automation, token/copy
  cease rules and transitions, continuous effects, visibility, Online/Solo/UI,
  versions, dependencies, release, and independent cold audit.
