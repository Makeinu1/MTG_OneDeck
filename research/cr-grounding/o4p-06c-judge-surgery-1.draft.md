# O4P-06C Judge Surgery 1

Date: 2026-08-21

The context-free cold auditor found one HIGH: Worker requests classified as
`create` or `lobby` reached `emitWorkerRequestFactV1`, but the frozen fact
allowlist omitted both actions and silently dropped every corresponding fact.

Accepted bounded correction:

1. add only `create` and `lobby` to the structured request-fact action allowlist;
2. add Judge acceptance proving successful create and lobby requests emit the
   two exact secret-free facts;
3. mechanically reanchor invalidated frozen hashes and rerun only affected
   tests/verifiers before returning the same fingerprint family to the original
   context-free auditor.

No request/response schema, authority, persistence, capability, CORS, package,
configuration, workflow, dependency, ledger, or deployment behavior changes.
