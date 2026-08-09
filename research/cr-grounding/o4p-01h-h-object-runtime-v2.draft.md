# O4P-01H-H implementation draft

Status: implemented-not-integrated.

The additive runtime import surface exposes the V2 runtime factory,
validator, canonicalizer, and V1 runtime adapter already implemented with
the registry cross-invariant. It reuses CoreCardObjectRuntimeStateV1 and
therefore admits exactly card and token object rows; spell-copy and ability
objects do not receive runtime rows.

Deferred: commands, token/copy creation, ability activation, trigger
detection, priority, resolution, targets, choices, copyable values, CR707
automation, cease rules, transitions, Online, Solo, UI, and release.
