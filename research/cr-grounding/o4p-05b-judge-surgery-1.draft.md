# O4P-05B Judge surgery 1

Base SHA: `76da2a67743d4e54f9ef6008ca86373963c965fe`

The requested Qwen Cloud implementer session
`01a00271-af11-78f3-9a12-7db73d4262bc` consumed 226,096 tokens while touring
already-shipped APIs, compacted twice, and produced no file changes. Two
bounded correction returns also produced no file changes.

Root cause: the first Judge contract incorrectly introduced a new production
releaseScenario API for evidence that belongs in an executable release review.
That violates the O4P-05B landing-state need and North Star 3 by creating meta
runtime surface with no play behavior.

Bounded correction: re-anchor O4P-05B to one Judge-owned integration review
that composes the existing shipped public Core, Room, Protocol, Headless,
Projection, Workbench, Table Display, Display Pairing, Guided Actions, and
O4P-05A ruleset surfaces. Add no production source or version. Preserve the
same four-player, final-state/event replay, revision, view-count, privacy, and
guided/manual acceptance semantics.
