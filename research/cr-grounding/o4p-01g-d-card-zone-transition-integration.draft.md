# O4P-01G-D Atomic Card Zone Transition Integration V1

Status: implemented-not-integrated

This draft records the D boundary. `applyCoreCardZoneTransitionV1` moves one existing card object between different zones, creates the next incarnation, routes owner-scoped destinations from `physicalCards[physicalCardId].ownerPlayerId`, applies explicit battlefield/stack controllers, and resets runtime through the committed A/B/C/R factories and validators.

The ordinary card-only vectors expressible here are ZT-01 through ZT-10 and ZT-12, plus the owner/controller divergence checks ZT-15 and ZT-16. Placement is deterministic: library index 0 is top, bottom appends, hand appends, graveyard appends at array end (top), and shared zones append.

DEFER: same-zone reorder (including ZT-20/21), shuffle generation, enters-tapped and other entry modifiers, face-down entry, replacement effects, commander replacement (ZT-23), tokens (ZT-24), copies (ZT-25), merged/melded objects, ability/event tracking, and the CR 400.7 exception inventory (ZT-28). No online commands or store integration is included.
