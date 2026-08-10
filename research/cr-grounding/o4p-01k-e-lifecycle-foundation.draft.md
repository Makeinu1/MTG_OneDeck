# O4P-01K-E Lifecycle Foundation implementation draft

Status: implemented-not-integrated.

Scope is limited to the additive Core turn lifecycle value boundary: position,
window, lifecycle slice, lifecycle factory input, strict validation, and the
contract's exact validation/operation code unions. No Core index, Registry,
Stack, Pending Trigger slice, Store, Solo, Online, UI, or review test was
changed.

The validator uses descriptor reads rather than property access, rejects
non-plain records, accessors, non-enumerable and symbol fields, sparse or
extended arrays, duplicate ordered IDs, invalid position/window combinations,
and unsafe numeric values. Successful values are freshly allocated in the
contract field order and deeply frozen. Cross-slice invariants requiring a
Registry or Stack remain deferred to the later lifecycle integration slices.
