# O4P-09A unified game surface cold-audit record

Date: 2026-08-25
Milestone: `O4P-09A`
Declared base: `0c0c7a533fffd8e3495cf74bb7d86b827f222c2e`
Frozen semantic commit: `f2ba4db8bd90513ce1eb37085a1945551058e141`
Risk: `R3 / STANDARD`
Auditor: `/root/o4p09a_cold_audit` (`gpt-5.6-sol`, high, fresh context)
Final audited fingerprint:
`23d5c3cd3e88ca3b817f658ab69ec47c2139e1834ea5ac4b1411816c26cf6b7d`
Counts: `BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`
Verdict: `AUDIT-OK-PENDING-EXACT-HEAD-CI`

## Candidate and correction history

The initial fingerprint exchange distinguished the canonical active-tree
fingerprint from the separate context checkpoint identity before any verdict
was accepted. The first valid semantic audit then reported one HIGH: the
shared `CommanderRitualLayer` still reached through to the Local Zustand store
when an injected interaction port was active.

The same bounded implementer lineage added the named
`resolveCommanderRitualCue` port operation, retained synchronous current-state
lookup in the Local adapter, removed the presentation-layer store fallback,
and added injected-cue evidence. The same cold auditor rechecked the affected
claim at fingerprint
`ab0cd6e8c74faa3a83114c20df6b44828162464fe33255a709cfe5e180cefddb`
with `0/0/0/0`.

The next local full check exposed only two historical Judge guards whose path
claims incorrectly followed the live O4P-09A tree. The seated Judge pinned
those claims to immutable registration closure
`0c0c7a533fffd8e3495cf74bb7d86b827f222c2e`, kept registration assertions on
the closure ledger, and derived the live next O4P-09 domain from the first
unshipped member. The same cold auditor verified the complete repaired tree at
the final fingerprint above with `0/0/0/0`; the repair does not allowlist an
O4P-09A product path or weaken historical exact-byte meaning.

## Local full-check record

Three invocations exist only because of two explicit governance events:

1. `check:fast` selected the release lane and stopped at stale Judge-owned UI
   manifest anchors before a canonical full result.
2. The canonical check passed every verifier, docs, lint, all 2,093 Core tests,
   and 2,416 of 2,418 DOM tests; only the two historical Judge guards failed.
3. The user explicitly approved one third and final local invocation after the
   exact Judge repair and cold re-audit. It passed every verifier, docs, lint,
   Core `227 files / 2,093 tests`, DOM `360 files / 2,418 tests`, TypeScript,
   and Vite build in 391,325 ms.

The final built assets were `index-F6C4yCH4.js` and
`index-B9TjsUJs.css`. No additional local full check is authorized or needed
for this milestone.

## Responsive local browser evidence

One stable browser session exercised the shared player surface at `375x812`,
`812x375`, and `1440x900`. All three viewports rendered the same GameScreen
child-tree signature, retained the board, hand, primary action, and undo
surface, and produced zero document/body horizontal overflow and zero console
errors. The root surface's border-box accounting measured 4, 4, and 7 pixels
respectively, without page overflow; this is not a second screen or responsive
fork.

## User rulings and remaining release gates

The user explicitly approved continuation of this existing candidate after the
implementer lineage reached 164 model cycles. The correction lineage completed
at 210 cycles and two compactions. The user separately approved the third and
final local full check above. These rulings do not widen product scope or
authorize another local full check.

Exact-head Actions, Judge ownership classification/reauthorization if
triggered, Pages publication, final public asset verification, production
browser evidence, `HEAD == origin/main`, and clean-worktree closure remain
mandatory before `shipped`. O4P-09A changes no Worker runtime, so a Worker
deployment is outside this milestone.

This record contains no Room ID, invitation code, capability, credential,
private card content, or raw private error.

## Semantic exact-head CI and ownership evidence

Semantic release candidate HEAD and `origin/main`:
`3fb115b58260bebbea6911642616bc8a863ef95c`

Workflow diff base:
`0c0c7a533fffd8e3495cf74bb7d86b827f222c2e`

Actions run `32808244750`, build job `97682451857`, checked out the exact
semantic candidate and passed the complete canonical
`npm run check -- --build-base=/MTG_OneDeck/` step. Core passed `227 files /
2,093 tests`; DOM passed `360 files / 2,417 tests` with one environment-skipped
test out of 2,418; all verifiers, docs, lint, TypeScript, and Vite build passed.
CI built `index-DJ9lpjXP.js` and `index-B9TjsUJs.css`.

Diff-base resolution then selected the exact workflow base above. The run
stopped only at the expected Judge ownership scan. Pages configuration,
artifact upload, and deploy job `97684939527` were skipped.

The classifier's stdout and stderr are interleaved in the Actions log; the
authoritative `forbidden-files.mjs` partition is seven `NEEDS-REAUTH` paths and
five `FORBIDDEN` Judge-review paths. All other changed paths are unclassified.

| Category | Path | Semantic candidate SHA-256 |
| --- | --- | --- |
| NEEDS-REAUTH | `docs/contracts/manifest.json` | `9a58d4ce4a0d387cf3ac0a6f58b9c0df0d438a7e49b6760cf6408d476f3b36f4` |
| NEEDS-REAUTH | `research/cr-grounding/archive/o4p-09a-unified-game-surface-cold-audit-record-2026-08-25.md` | `ae3e59d48066aa14d139029ace4df1a1feeb68b43731c7ee3853890331450dbe` |
| NEEDS-REAUTH | `research/cr-grounding/cr-backbone-ledger.json` | `54b7b3d98504df1122a9ec4d6c0bcfe6c04efcf13bbb0185fe6d0059e82c30d6` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-09a-acceptance-brief.draft.md` | `fac0873e5c729677b82e8907a97b8f51e295aa1f7401b785d9de2eb7d568893c` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-09a-cold-audit-brief.draft.md` | `2e0180511186fedd66c11e7459fc50d61bfb33fcbce91d45433cb81bf8f3b033` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-09a-implementation-brief.draft.md` | `b564d1a69e7be2650ad41c579b0370dca3132d8bfaa52d899d3f4c35e4edd9bb` |
| NEEDS-REAUTH | `research/cr-grounding/o4p-09a-unified-game-surface.contract.draft.md` | `d4512561f5e13caf933d707e81726aea6af7e7c67d4c5004453fb42331749b0d` |
| FORBIDDEN | `src/components/game/OpponentSetupScreen.review.test.tsx` | `09623f4e2c1f3a9a9c7d78737b64cefe7bba2c0ce13b134fab2b545e477fbcda` |
| FORBIDDEN | `src/components/game/__tests__/review.s1-stack-pile.test.tsx` | `db69660c06003c46b80b0dff0141f13c769bcc2952281a1c68840d0680ae7c01` |
| FORBIDDEN | `src/test/architecture/review.gov-codex-56r2-request-normalization.test.ts` | `86dcae354964e5817610be0c57838b2699b05c80f81a92ad624b9b1ab07a5626` |
| FORBIDDEN | `src/test/architecture/review.o4p-09-roadmap-registration.test.ts` | `b7d44782b7b10f7e980b63a0740f3fa0ed8b41b6257c17e973471aa419990f54` |
| FORBIDDEN | `src/test/architecture/review.o4p-09a-unified-game-surface.test.ts` | `fe1842809f0776df09846aae507b18a99e72b07bfc8625782a36109ba6c88777` |

The proposed replacement changes only this record and the synchronized
O4P-09A ledger entries. It changes no product, contract, review, dependency,
configuration, workflow, or generated byte. One replacement push must still
pass exact-head CI, the now metadata-only ownership scan, artifact upload,
Pages deployment, public asset verification, and production browser evidence.

`O4P-09A-CI-OWNERSHIP-REAUTH-APPROVED`
