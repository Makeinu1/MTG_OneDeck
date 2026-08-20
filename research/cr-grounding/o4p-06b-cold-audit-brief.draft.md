# O4P-06B Cold Audit Brief

Milestone: `O4P-06B`
Base SHA: `a0c33741f5a2bde35f5e9a621671f5908a6b1284`
Risk lane: R3 / STANDARD
Role: context-free cold auditor, findings only

## Authorities

- `AGENTS.md`
- `research/cr-grounding/o4p-06b-playable-table-command-surface.contract.draft.md`
- `research/cr-grounding/o4p-06b-acceptance-brief.draft.md`
- pinned local CR 2026-06-19 clauses cited by the contract

The frozen candidate fingerprint is the current value in
`.claude/loop-state.md` and `npm run codex:context -- --domain O4P-06B`.

## Frozen candidate paths

- `src/engine/core/closure/applyCommandV1.ts`
- `src/engine/core/closure/commandV1.ts`
- `src/engine/core/closure/domainEventV1.ts`
- `src/engine/core/index.ts`
- `src/engine/core/tabletop/**`
- `src/online/protocol/support.ts`
- `src/online/protocol/__tests__/protocolV1.test.ts`
- `src/online/headless/__tests__/review.o4p-06b-playable-table-command-surface.test.ts`
- the O4P-06B Judge drafts in `research/cr-grounding/`

Do not edit any file and do not run `npm run check`. Return findings only.

## Required adversarial audit

Audit the complete frozen matrix, not merely the correction diff:

1. closed runtime validation for all eight payload discriminants, including
   accessors, symbols, prototypes, revoked proxies, cycles, sparse arrays,
   unsafe keys/IDs, negative zero, non-finite values, underflow, overflow,
   no-op, collision, and secret reflection;
2. CR 121 draw atomicity and CR 400.7 reincarnation, including hidden-source
   authority, object/runtime/control/attachment/announcement/reference cleanup,
   same-zone/non-card rejection, physical/definition identity, ordering, and
   canonical deep freeze;
3. tap, mana, counter, token create/remove exact semantics, ownership/control,
   synthetic-definition validation, stale references, token seed/definition
   reuse, and unrelated-state preservation;
4. turn checkpoint/position/next-turn delegation, active-player authority,
   nonempty stack, pending trigger, priority/SBA/choice/cleanup gates, draw-step
   draw, untap, mana emptying, turn rotation, and no branch skipping;
5. Core sequence, event, journal/replay, rejected-root identity, deterministic
   digest, protocol revision/receipt/duplicate/stale/ID-reuse behavior, and
   projection consistency;
6. participant-seat and decision authority, table/observer rejection,
   disconnected/finished players, hidden information, and eight-character
   configured-capability fragment rejection in command values and keys without
   changing the established Protocol state/ID validation layer;
7. module/import direction, public barrel, version/schema invariants, existing
   architecture tests, no dependency/config/cache/projection/Cloudflare/UI
   expansion, and no arbitrary Oracle/state-patch claim; and
8. test quality: real four-deck executable final-state evidence, four distinct
   actors, non-vacuous assertions, replay from exact initial root, privacy
   evidence, and whether any advertised acceptance condition remains unproved.

## Reproduction commands

Use targeted evidence only, for example:

```sh
npx vitest run --project core src/engine/core/closure src/engine/core/tabletop src/engine/core/turn
npx vitest run --project dom src/online/protocol src/online/headless src/online/projection
npx vitest run --project dom src/test/architecture/modeNeutralCoreBoundary.test.ts src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts src/test/architecture/onlineModuleKindRegistry.test.ts
npx tsc -b
npx eslint src/engine/core/closure src/engine/core/tabletop src/engine/core/index.ts src/online/protocol/support.ts src/online/protocol/__tests__/protocolV1.test.ts src/online/headless/__tests__/review.o4p-06b-playable-table-command-surface.test.ts
git diff --check
```

## Verdict format

Return counts as `BLOCKER/HIGH/MEDIUM/LOW`, then each finding with severity,
path/line, exact reproduction, violated clause, and smallest safe correction.
If BLOCKER/HIGH are zero, say exactly `AUDIT-OK-PENDING-FULL-CHECK` and list any
residual MEDIUM/LOW. A timeout or unrun evidence is no verdict.
