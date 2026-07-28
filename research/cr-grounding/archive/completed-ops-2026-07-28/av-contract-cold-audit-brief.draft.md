# AV contract cold-audit brief

**role**: cold auditor / findings only  
**claimed status**: `docs/audio-visual-contract.md` and linked sections are an active, pre-implementation contract. They claim the AV implementation is **not implemented** and identify legacy conflicts.  
**constraint**: Do not edit, create, delete, format, or stage files. Do not propose implementation code. Return findings only.

## Scope

- `AGENTS.md`
- `docs/audio-visual-contract.md`
- `docs/design-vision.md` §2 and roadmap AV0–AV4
- `docs/design-system.md` §7–§8a and §9
- `docs/ui-architecture-v2.md` §7
- `docs/acceptance.md` M-AV
- `docs/README.md`
- `docs/design-playbook.md` supersession notices and old D6/D7
- `research/cr-grounding/cr-backbone-ledger.json` entries `d6-chain-feel`, `d7-sound-session`, `d8-ambient-layer`
- `research/design/bpm-synced-audiovisual-revision.draft.md` status boundary

Out of scope:

- UI/audio implementation
- the separately produced contents under `research/audio/`
- loop audio quality or asset rights
- CR engine behavior unrelated to presentation

## User decisions that the contract must preserve

Adversarially verify that the files, read by a weaker implementation model, cannot reasonably invert these decisions:

1. Normal AV supports thought and embodied rhythm; it does not score actions or auto-escalate excitement.
2. Same semantic action returns the same perceived response. Consecutive casts do not become louder/brighter/longer.
3. Musical events initially occur only for successful ordinary spell cast, land play, and turn advance.
4. Stack resolution is not the main decision moment and has no musical sound; functional causal visuals may remain.
5. Pointer/touch/keyboard/DnD/menu inputs do not directly trigger musical sound.
6. Combat AV is deferred and initially silent/no new effect, including no combat tempo acceleration.
7. Commander cast is the explicit special exception: dedicated existing visual identity, dedicated sound, generic cast suppressed, BGM briefly ducks without stopping, and gameplay does not wait.
8. GameState and immediate causal feedback never wait for beat sync. Initial bounded snap is tunable and user judged.
9. Dark music uses the full song as a periodic loop, not a short phrase and not raw `loop=true`; final manifest/rights remain unresolved.
10. Browser performance is a contract. Effects degrade before interaction, readability, or GameState.
11. Machine metrics do not replace the user's comfort judgment.

## Audit procedure

1. Read `AGENTS.md` and `docs/judge-protocol.md` first.
2. Read every in-scope file without relying on this brief as proof.
3. Search active docs and the ledger for stale phrases/semantics: chain escalation, stack-resolution sound, direct click/primary sound, combat 525ms, fixed 700ms as active BGM clock, old D7 no-loop rule, commander resolution-time blocking.
4. Compare authority/status labels. Confirm historical text cannot be mistaken for an executable contract and the active source is discoverable from `AGENTS.md` and `docs/README.md`.
5. Compare WHAT/HOW/VERIFY:
   - every allowed event has an implementable exactly-once source and acceptance case;
   - every forbidden/deferred event has a negative boundary;
   - failure/cancel/undo/reload/input-route boundaries are covered;
   - commander replacement and nonblocking rules are testable;
   - performance targets are internally consistent.
6. Inspect the named current source files only enough to check that the migration table is honest:
   - `src/components/game/sound.ts`
   - `src/components/game/ThumbZone.tsx`
   - `src/components/game/HandRibbon.tsx`
   - `src/components/game/CelebrationLayer.tsx`
   - `src/components/game/celebrationTimelineModel.ts`
   - `src/components/game/gameController.tsx`
   - `src/components/game/CommanderCutIn.tsx`
   - `src/components/game/ambientMotion.ts`
7. Confirm the contract does not claim current compliance or shipped implementation.
8. Run read-only structural checks as useful. The parent reports `npm run check` PASS: lint, 286 test files / 2282 tests, build. Treat that as evidence to verify, not as proof of semantic correctness.
9. Try to write a plausible but wrong lower-model implementation plan. Report any clause that would allow it without clearly violating a MUST/MUST NOT/DEFER or acceptance case.
10. Adversarially include these boundary paths:
    - master/musical-event OFF、manifest unavailable、load/decode/resume failure versus ready transport outside the snap window;
    - configured beat-anchor subdivision versus snap-window and latency acceptance;
    - cast → undo → a genuinely new cast whose engine eventId/sequence is reused, followed by redo/reload/React remount;
    - hover/focus/preview/scroll/drag start/reorder/target search;
    - every production caller of legacy `primary` / `draw` / `resolve` / `chain` celebration sounds.

## Severity

- **BLOCKER**: active documents give incompatible commands or implementation cannot identify the source of truth.
- **HIGH**: a weaker model can implement a user-rejected behavior while plausibly claiming contract compliance; acceptance cannot catch it.
- **MEDIUM**: ambiguity, stale cross-link, untestable threshold, or missing negative boundary that should be fixed before implementation.
- **LOW**: clarity or maintainability improvement that does not change likely behavior.

## Required output

Start with:

`AV-CONTRACT verdict: SHIPPED-OK | BLOCKER | HIGH | MEDIUM | LOW`

Then list findings in descending severity. For each:

- severity
- exact file and line
- conflicting decision or exploitable ambiguity
- smallest contract-level correction

If no findings, state `BLOCKER/HIGH/MEDIUM/LOW = 0` and briefly list the adversarial paths checked. Do not edit files.
