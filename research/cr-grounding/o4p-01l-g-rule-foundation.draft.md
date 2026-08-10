# O4P-01L-G rule foundation draft

Implementation lane G adds the reusable Core rule foundation named by the
frozen O4P-01L contract: opaque rule keys, closed player/shared zone
references, generic durations, hostile-input-safe exact-record readers, JSON
Pointer helpers, deterministic issue ordering, canonical records, and deep
freezing. The operation error code union is defined separately and remains
closed to the contract's listed values.

The implementation is additive under `src/engine/core/rules/**`; barrel
integration and all later rule slices remain deferred to their assigned lanes.
Focused tests cover non-normalized keys, the zone and duration unions, zero
values, descriptor/accessor/symbol/non-enumerable/unsafe-key rejection, fresh
frozen results, and JSON round-trip safety.

Verification was attempted with the focused Vitest and TypeScript commands,
but the independent worktree has no installed dependency tree. Reusing the
parent binaries failed because the worktree cannot resolve its Vite/Vitest
dependencies and the sandbox denied Vite's generated config write. This is an
environment/install signal, not a production-file change.


