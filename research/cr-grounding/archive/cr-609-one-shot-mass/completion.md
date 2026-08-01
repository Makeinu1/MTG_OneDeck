# CR609 one-shot mass destroy completion packet

- Milestone: `cr-609-one-shot-mass`
- Base SHA: `a5a594ead1b5488735be129b6579622fa142897e`
- Judge: Codex
- Implementer: `/root/cr609_implementer`
- Cold auditor: `/root/cr609_cold_auditor`

## Delivered slice

- Atomic `destroyPermanents` with explicit-card and bounded battlefield-filter
  selectors, `destroy` zone-change reason, and one simultaneous group.
- Pre-state freezing for type, controller, mana value, indestructible, and the
  existing graveyard replacement result.
- Existing target destroy and Feed the Swarm-style follow-up life loss use the
  same command semantics without intermediate SBA/priority during resolution.
- CR704 lethal/deathtouch destruction respects indestructible; zero toughness
  remains a non-destruction graveyard move.
- Exact mass-destroy grammar covers Ruinous Ultimatum and saved-X Pernicious
  Deed shapes while unsupported or conditional composites fail closed.
- Golden replays terminate in a verified final `GameState` for both real-card
  cases.

## Verification evidence

- Judge targeted suite: 13 files / 208 tests passed before freeze.
- Repair pins: CR609 19/19 and snapshot 3/3 passed; ESLint and TypeScript build
  passed.
- Browser resolution of 《Ruinous Ultimatum》 destroyed the opponent creature
  and artifact, retained the opponent land, opened no manual-resolution UI,
  and restored the stack and board with one undo.
- Browser responsive checks covered 375x812, 812x375, and 1440x900 with no
  horizontal overflow and console error 0.
- Independent final audit: BLOCKER/HIGH/MEDIUM/LOW 0 and
  `AUDIT-OK-PENDING-FULL-CHECK`; detailed findings are stored beside this file.

## Deferred boundary

Culling Ritual result-dependent mana, mass damage, temporary -X/-X,
regeneration clauses, missing announced X, and CR616 multiple replacement
choice remain whole-effect manual. No GameState field, snapshot version, or
dependency was changed.

The release judge records the one final full-check, commit, push, CI, Pages,
served-asset, and clean-worktree evidence in the shipping task handoff.
