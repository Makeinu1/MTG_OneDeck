# cr-120-damage batch2-6 implementer scoping draft

Status: implementer-lane draft only. J0 mode is not active, so this file does not update
`docs/`, `review.*`, or `research/cr-grounding/cr-backbone-ledger.json`.

## Planned slice

Ledger plannedSequence batch2-6:

`cr-120-damage`: `damage:write 33` / `event:damage 7` = non-combat, source-backed
damage. The planned note says §34.18 damage is type-only, so this slice should add
`DamageEvent` emission plus links from the damage event to its results
(`lifeChange`, marked damage, loyalty/counter changes later).

There is a ledger wording mismatch to resolve: the domain `nextGate` still mentions
"commander damage loss" first, but current spec text already documents advisory-level
commander damage as implemented. For this batch2-6 scope, the useful unresolved work is
source-backed ordinary damage, not another commander-damage advisory pass.

## Current substrate evidence

Existing core pieces already present:

- `CardInstance.damageMarked` and `hasDeathtouchDamage` model marked creature damage.
- Public `markDamage` records source-less marked damage and deliberately emits no `DamageEvent`.
- `resolveCombatDamage` can mark creature damage and aggregate unblocked player life loss, but
  current event tests pin that it emits `lifeChange` only and no source-backed `damage` event.
- `DamageEvent`, `EventSourceRef`, `EventTargetRef`, and `damageResultEventIds` already exist in
  `src/engine/types.ts`.
- `lifeChange` and `draw` already use the event envelope; draw also shows the expected pattern for
  linking a result event to a zone-change event.

Relevant evidence files:

- `src/engine/types.ts`
- `src/engine/commands.ts`
- `src/engine/__tests__/eventEnvelope.test.ts`
- `src/store/__tests__/review.s-events-envelope.test.ts`
- `src/store/__tests__/review.damage-marked.test.ts`
- `src/store/__tests__/review.combat.test.ts`

## CR grounding

- CR 120.1: objects can deal damage to battles, creatures, planeswalkers, and players; the object
  that deals damage is the source.
- CR 120.2b: damage may be dealt as an effect of a spell or ability, and that spell/ability
  specifies which object deals that damage.
- CR 120.3a: damage dealt to a player by a source without infect causes life loss.
- CR 120.3c: damage dealt to a planeswalker removes loyalty counters.
- CR 120.3e: damage dealt to a creature by a source with neither wither nor infect marks damage.
- CR 120.3f: lifelink causes life gain in addition to other damage results.
- CR 120.4b-d: a damage event is modified by replacement/prevention, processed into results, then
  the damage event occurs.
- CR 120.8: a source that would deal 0 damage does not deal damage at all.
- CR 704.5g/h: lethal/deathtouch marked damage destroys creatures via SBA, not directly by the
  damage source.

## Proposed implementation shape for a future brief

Do not broaden `markDamage` into sourced damage. It is already reviewer-pinned as a low-level,
source-less marked-damage command. Add a separate source-backed damage path.

Suggested substrate:

- Add a source-backed command or internal transaction such as `dealDamage` with:
  - source ref/snapshot,
  - target ref/snapshot or player target,
  - nonnegative amount,
  - `combatDamage` boolean,
  - optional source flags derived by the caller (`deathtouch`, `infect`, `wither`, `lifelink`).
- If `amount <= 0`, do nothing and emit no `DamageEvent` per CR 120.8.
- Emit one authoritative `DamageEvent` before or with the result events, then record result event
  ids in `damageResultEventIds`.
- For player damage in the first slice, produce a `lifeChange` result linked back to the damage
  event (`sourceEventId` or `causeEventId`), not a bare `adjustLife` cause.
- For creature damage in the first slice, mark damage in the same draft and link any resulting
  zone-change/SBA destruction events only if the existing event envelope has a clear way to do so.
  If not, pin the damage event and marked state first, then defer result linking for SBA.
- Keep compiler grammar conservative: `effect.damage` currently remains manual/guided-not-auto.
  A future UI/store helper may execute a selected target through `dealDamage`, but grammar should
  not auto-resolve "any target" without a target prompt and source snapshot.

## High-risk boundaries to keep manual

- Prevention/replacement/redirection (CR 120.4a/b, 614/615).
- Infect, wither, toxic, lifelink, and "damage can't be prevented" unless the source flags and
  result hooks are explicitly pinned.
- Planeswalker/battle damage until loyalty/defense counter result events are authoritative.
- Each-player/each-opponent damage and multi-target damage until event grouping and per-player
  targets are clean.
- Variable/X damage.
- Commander damage automatic attribution from combat; current advisory-level commander damage is
  manually tracked/coarse and should not be conflated with source-backed ordinary damage.

## Suggested golden/review pins

Future judge-owned pins should distinguish these cases:

- Source-backed noncombat damage to P1/opponent emits exactly one `DamageEvent` and one linked
  `LifeChangeEvent`.
- Source-backed noncombat damage to a creature emits a `DamageEvent` and marks damage; lethal
  destruction still happens through 704.5g SBA.
- Source-backed deathtouch damage to a creature emits `DamageEvent`, marks `hasDeathtouchDamage`,
  and 704.5h handles destruction.
- `amount:0` emits no `DamageEvent`.
- Legacy/source-less `markDamage` remains source-less and continues to emit no `DamageEvent`.
- Existing combat tests stay green until combat is explicitly migrated to source-backed damage.

## Proposed judge decision

Keep this as a future implementation slice after the current `cr-701-keyword-actions-frequent`
ambiguity is resolved. Before implementation, judge should re-own the stale `cr-120-damage`
`nextGate` wording: if commander damage advisory is accepted as shipped, batch2-6 should focus on
source-backed `DamageEvent` and result links.

## Non-claims

- No code is implemented in this draft.
- No docs, review tests, or ledger body were changed.
- This draft does not claim `cr-120-damage` batch2-6 is complete or shipped.
