# O4P-01H-D Object ID V2 implementation draft

Status: implemented-not-integrated

The additive `objectIdV2.ts` module implements strict parsing and explicit
factories for card, token, spell-copy, activated-ability, and triggered-ability
object IDs. Card IDs retain the existing `CorePhysicalCardId:incarnation`
bytes. Seeds use the existing Core base-ID grammar and incarnations require
canonical non-negative safe decimal integers.

Ordinary and fast-check tests cover canonical round trips, malformed prefixes,
seeds and incarnations, numeric-like literal seeds, collision separation,
accessor non-execution, and input preservation.

This slice is intentionally not exported through a core index and does not
implement registry objects, allocation, zone transitions, stack processing, or
any deferred O4P-01H behavior. Independent cold audit, integration, full check,
and release evidence remain deferred.
