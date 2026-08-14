# O4P-04C final full-check repair cold-audit brief

## Role

Independent cold auditor. Read only; do not edit files and do not run `npm run check`.

## Frozen target

- Milestone: `O4P-04C`
- Base/HEAD: `d5c0160db83cf5adc7e6191cd72a84e2d095f515`
- Audit the current working-tree candidate on top of that HEAD.
- Original cold-audit record: `research/cr-grounding/archive/o4p-04c-cold-audit-record-2026-08-14.md`

## Changed audit surface

- `src/test/architecture/modeNeutralCoreBoundary.test.ts`
- `src/test/architecture/review.o4p-04b-table-display-boundary.test.ts`
- `src/test/architecture/review.o4p-04c-display-pairing-boundary.test.ts`
- `research/cr-grounding/o4p-04c-full-check-repair-1.draft.md`

## Audit requirements

1. Verify the global Core boundary remains fail-closed: only the exact O4P-04C files, public Core barrel, import kinds, and imported symbol names required by the frozen production candidate are accepted. Probe an extra symbol, an extra file, a deep Core import, and an unregistered import form.
2. Verify the O4P-04B successor registration admits only the approved O4P-04C display-pairing composition and its exact base-relative candidate paths. Probe unrelated production reachability and an unexpected candidate path.
3. Verify the O4P-04C scope test remains fail-closed after registering the two repair-owned architecture files.
4. Reconfirm the original O4P-04C privacy, capability-secrecy, seat/session binding, focus, responsive, production-entry-point, and DEFER findings remain closed by inspecting the frozen candidate and running only targeted/adversarial evidence needed for these claims.
5. Report the candidate tree/context fingerprint and findings as `BLOCKER/HIGH/MEDIUM/LOW`. Return `AUDIT-CLEAR` only when `BLOCKER/HIGH = 0`; otherwise return findings only.

## Evidence already run by the Judge

- Invalidated plus O4P-04C target suite: 10 files / 48 tests PASS.
- `check:domain -- multiplayer`: Core 106/699 and DOM 104/671 PASS.
- `check:domain -- ui-responsive`: Core 103/677 and DOM 201/1342 PASS.
- Scoped ESLint, `tsc -b`, `check:docs`, and `git diff --check`: PASS.
