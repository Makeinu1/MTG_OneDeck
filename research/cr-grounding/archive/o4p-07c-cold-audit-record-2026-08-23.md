# O4P-07C cold-audit record

Date: 2026-08-23
Milestone: `O4P-07C`
Base SHA: `6899fd4a9e1adba71651d883174647970f7a5d59`
Auditor: `/root/o4p07c_final_luna_cold_audit` (`gpt-5.6-luna`, xhigh,
fresh-context at first audit)

## Frozen authority

- Contract:
  `research/cr-grounding/o4p-07c-fixed-runtime-removal-production-release.contract.draft.md`
- Final audit brief:
  `research/cr-grounding/o4p-07c-final-verifier-reaudit-brief-2026-08-23.draft.md`
- Final semantic fingerprint, excluding the two audit briefs and this derived
  record:
  `250986253e6a3f6cde99ef25ef46df323676f22767ab8e7922df892e6059f587`
- Final pre-record complete staged fingerprint:
  `6630d7b0a752ab06b9fe6b3c2dc6bdd794fd68b473b6fb91b7ed502294394195`

## Audit history

The first fresh audit matched its frozen fingerprints and rejected with
BLOCKER 0 / HIGH 5 / MEDIUM 1. It reproduced repository/import and artifact
symlink escapes, extensionless ambiguity, unsafe legacy cutoff validation,
finished-Room cutoff drift, substituted Pages paths, and unquoted script
sources.

The bounded repair and reaudit then closed those findings and exposed the last
fail-closed syntax boundaries: protocol lifecycle `started`, absolute/scheme
imports, `import.meta` loaders, and browser code loaders through Worker,
SharedWorker, service-worker registration, `importScripts`, and worklet
`addModule`. After the implementer's two repair waves, the Judge applied only
the corresponding guard and ordinary-test surgery. Static property and
string-literal element-access forms were included in the final probes.

## Final verdict

- BLOCKER: 0
- HIGH: 0
- MEDIUM: 0
- LOW: 0
- Token: `O4P-07C-AUDIT-OK-PENDING-FULL-CHECK`

The auditor confirmed every prior import, symlink, ambiguity, Pages path,
script, malformed legacy, collision/fragment, lifecycle, and static code-loader
probe now rejects or passes as contracted. Legitimate `import.meta.env`, plain
non-code asset `new URL`, same-base CSS siblings, bare packages, and relative
imports remain valid.

## Evidence and remaining gates

- final targeted and preserved v2/recovery tests: passed;
- affected ESLint and diff checks: passed;
- canonical Pages build: passed, 327 modules;
- verifier: `graph=324 pages-js=1 worker=deferred`;
- fixed fixture bytes and dependencies/configuration: unchanged.

The full canonical check, exact-head CI, Pages/Worker deployment, four-context
and cross-browser production acceptance, and terminal ledger closure were not
part of this audit and remain required before shipment.

## Full-check repair audits

1. Exact-head Actions `32614875094` stopped at the historical O4P-03A frozen
   hash after the product change. The bounded verifier/allowlist repin candidate
   fingerprint `34b379dffdbb4e707639ae4354827e7ef12305d4a6b95da03230275c99d50cfe`
   was independently audited by `/root/o4p07c_fullcheck_repair_luna_audit`.
   All 84 pins and the O3A -> O3B -> O3C -> O3D -> O5C -> O5D chain matched;
   findings were `0/0/0/0`, token
   `O4P-07C-FULL-CHECK-REPAIR-AUDIT-OK`.
2. Replacement Actions `32615426397` reached Vitest and exposed seven stale
   review expectations. The seven-review repair plus its two briefs froze at
   `baa2eb8cac3b7a92735b536cfe381d93e7627b8b17d09f7872c1fbd49b76a78f`.
   Read-only auditor `/root/o4p07c_fullcheck_repair2_luna_audit` verified seven
   files / 34 tests, affected ESLint, and exact scope with findings `0/0/0/0`,
   token `O4P-07C-FULL-CHECK-REPAIR-2-AUDIT-OK`.
3. The user-authorized exceptional Actions `32632994186`, build job
   `97178491909`, then stopped at the O4P-03A review hash before lint, Vitest,
   build, O4P-07C production verification, ownership, or Pages. The five-file
   SHA-chain repair plus two briefs froze at
   `e040f3e2cc9c3e04cbf8bb2df7948a9ebebf6914a5db8119690818304bf718ae`.
   Fresh read-only auditor `/root/o4p07c_fullcheck_repair3_luna_audit`
   recomputed the six review pins, three downstream verifier pins, O5C-to-O5D
   pin, final hashes, five direct verifier results, ESLint, and diff scope.
   Findings were `0/0/0/0`, token
   `O4P-07C-FULL-CHECK-REPAIR-3-AUDIT-OK`.

No full-check, deployment, Pages, Worker, or shipment success is claimed by
these correction audits. Another full-check requires a new explicit user
exception.
