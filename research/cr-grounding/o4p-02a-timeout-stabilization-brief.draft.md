# O4P-02A release-timeout stabilization brief

Status: frozen by the judge on 2026-08-12.

Base SHA: `66084e9332838f7da475fbfea34ea00d86242d5e`

Goal: remove the release-gate timing false negative without changing any
O4P-01N assertion, product behavior, or O4P-02A semantics.

## Implementer write scope

- `src/engine/core/closure/__tests__/repairWave1.test.ts`

## Required change

- Add a per-test `30_000` millisecond timeout only to
  `closes the complete deterministic four-player payload surface and
  round-trips replay`.
- Do not change, remove, reorder, skip, or weaken any setup, command, assertion,
  expected value, or tamper vector.
- Do not change global Vitest configuration or any production source.

## Forbidden

- No `review.*`, `docs/`, ledger, archive, loop-state, package, dependency, git,
  or generated-file changes.
- No full `npm run check`; the implementer runs only the exact affected file.

## Implementer evidence

Run exactly:

```sh
npx vitest run src/engine/core/closure/__tests__/repairWave1.test.ts
git diff --check -- src/engine/core/closure/__tests__/repairWave1.test.ts
```

Report the changed file, the unchanged assertion boundary, exact test result,
and any unresolved issue.

## Done when

- the exact file passes at repository defaults;
- the only semantic diff is the local timeout argument;
- a fresh cold auditor confirms no assertion weakening and BLOCKER/HIGH 0.
