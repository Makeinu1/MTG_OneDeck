# cr-115 targets / filter legality draft

Status: implementer draft for the next plannedSequence item after `cr-110-permanents`.
Non-review code/test pins now exist for a narrow target-filter legality slice; no `docs/` or
`review.*` changes were made.

CR source: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`, fixed to 2026-06-19.

## Why this slice

Ledger next item:

- `cr-115-targets`
- Note: `target:object-or-player 97`; activation-time target saving exists for activated abilities,
  but CR 115 legality and resolution-time illegal target handling are not contracted.
- Golden candidates named by ledger: Mother of Runes / Path to Exile / Skyclave Apparition.

The full domain is broad. This implementer slice only improves target **candidate legality filters**
for already-supported single battlefield-object targets.

## CR grounding

- CR 115.1: targets are object(s) and/or player(s) a spell or ability will affect, chosen as part
  of putting the spell or ability on the stack.
- CR 115.1a: instant/sorcery targets use "target [something]"; targets are chosen as the spell is
  cast via CR 601.2c.
- CR 115.1c: activated ability targets are chosen as the ability is activated via CR 602.2b.
- CR 115.1d: triggered ability targets are chosen as the triggered ability is put on the stack via
  CR 603.3d.
- CR 115.2: only permanents are legal targets unless the spell/ability specifies another zone,
  player, spell, or ability.
- CR 601.2c: target choices must obey the targeting criteria.
- CR 608.2b: targets are checked again on resolution; all-illegal targets prevent resolution.

## MyDeck demand measurement

Input: `research/mydeck-scoring/gaps.json`, rows whose `missingReadWrite` includes
`target:object-or-player`.

Total rows: `97`.

Quick buckets from clause excerpts:

| bucket | count | examples / note |
|---|---:|---|
| other target | 59 | baseline object targets such as target creature/permanent/card; broad and mixed |
| you-control target | 15 | Mother of Runes, Thassa, Forensic Researcher |
| another target | 10 | Forensic Researcher, Ioreth, Kelpie Guide, Fatestitcher |
| target player | 9 | Bojuka Bog, Gitaxian Probe, Radiant Lotus |
| nonland target | 5 | Skyclave Apparition, Rite of Oblivion, Binding the Old Gods |
| opponent-controlled target | 3 | Vandalblast / Binding-style controller restriction |
| noncreature target | 3 | counter noncreature spell, Haywire Mite-style text |
| any target | 2 | Niv-Mizzet, Ugin |
| artifact-or-enchantment target | 1 | Cathar Commando |

## Implemented narrow slice

Files:

- `src/engine/grammar/compile.ts`
  - `TargetFilter` now carries optional `excludedTypes` and `excludeTokens`.
  - Guided single battlefield-object target parsing preserves `nonland`, `noncreature`, etc.
  - `nontoken` is preserved as `excludeTokens`.
  - `you control` can be absorbed into the target filter instead of forcing manual when the target
    clause is otherwise supported.
  - `you don't control` / `an opponent controls` can be absorbed into the target filter as
    `controller: opponent`.
  - `another target` / `other target` is preserved as `excludeSource`.
  - Comma-separated restrictions such as `nonland, nontoken permanent` remain in the target noun
    phrase instead of forcing manual.
- `src/engine/commands.ts`
  - Activation-time target prompts preserve the same `excludedTypes` / `excludeTokens` filter data.
  - Activation-time target prompts preserve `excludeSource` for `another target`.
  - `eligibleTargets` removes excluded types, tokens, optionally the source object, and
    nonmatching controllers before accepting broad `permanent` targets.
- `src/components/playmat/Playmat.tsx`
  - Guided target picker passes the pending source id to `eligibleTargets`, so source exclusion is
    reflected in visible candidates as well as store confirmation.
- `src/engine/__tests__/cr115TargetFilterCompiler.test.ts`
  - Pins compiler filters for `target nonland, nontoken permanent` and
    `target noncreature artifact`.
  - Pins `another target permanent you control` as `controller: you` plus `excludeSource`.
  - Pins `you don't control` and `an opponent controls` as `controller: opponent`.
- `src/store/__tests__/cr115TargetFilters.test.ts`
  - Pins spell resolution for `Exile target nonland permanent.`
  - Pins activated ability target selection for `{T}: Destroy target nonland permanent.`
  - Pins activation-time source exclusion for `{T}: Untap another target permanent you control.`
  - Pins spell and activation-time target selection for opponent-controlled battlefield permanents.

## Scope boundary

In scope:

- Single battlefield-object target prompts already handled by the existing guided target substrate.
- Type exclusion words of the form `non<type>` for supported target types:
  `creature`, `artifact`, `enchantment`, `land`, `planeswalker`, `permanent`.
- `nontoken` exclusion using existing `CardInstance.isToken`.
- `you control` positive controller filter for otherwise supported single battlefield targets.
- `you don't control` / `an opponent controls` opponent-controller filter for otherwise supported
  single battlefield targets.
- `another target` / `other target` source exclusion for otherwise supported single battlefield
  targets.
- Both spell/trigger guided prompts and activated ability activation-time prompts.

Out of scope / defer:

- Spell cast-time target storage. Current spell/trigger guided flow still chooses targets at
  resolution; this slice does not rework cast/trigger stack construction.
- CR 608.2b full resolution-time illegal-target handling for spells/triggers. Activated abilities
  already have stored object identity and warn when the saved object no longer matches.
- Player targets and `any target` damage targets.
- Non-battlefield targets such as `target creature card in your graveyard`.
- Rich multiplayer target policy. This slice can filter existing `controllerId !== P1` permanents,
  but it does not create a full opponent battlefield workflow.
- Numeric/value filters such as mana value, power, toughness, color, legendary, or "another".
- Multiple/up-to/every target selection.

## Judge promotion suggestions

Potential reviewer-owned pins:

1. `cr115-nonland-spell-target-filter`
   - `Exile target nonland permanent.`
   - Land is not a candidate; artifact/enchantment/creature permanents remain candidates.
   - CR refs: 115.1a, 115.2, 601.2c.
2. `cr115-nontoken-target-filter`
   - `Exile target nonland, nontoken permanent.`
   - Tokens matching the positive type are excluded.
   - CR refs: 115.1a, 115.2.
3. `cr115-activation-target-filter`
   - `{T}: Destroy target nonland permanent.`
   - Invalid target does not commit cost or stack object in rules-legal mode; valid target is stored
     activation-time.
   - CR refs: 115.1c, 602.2b.
4. `cr115-another-target-excludes-source`
   - `{T}: Untap another target permanent you control.`
   - Choosing the source itself is illegal and does not commit costs/stack object; choosing another
     controlled permanent is legal.
   - CR refs: 115.1c, 601.2c via 602.2b.
5. `cr115-opponent-controlled-target-filter`
   - `Destroy target artifact you don't control.` and
     `{T}: Tap target creature an opponent controls.`
   - P1 permanents are not candidates; `controllerId !== P1` permanents are candidates.
   - CR refs: 115.1a, 115.1c, 115.2, 601.2c via 602.2b.
6. Boundary pins:
   - `target player` remains manual unless the effect has a modeled player-target consumer.
   - `any target` remains manual until CR 115.4 + damage target support is added.
   - `target creature card from your graveyard` remains manual until non-battlefield targets are
     modeled.

## Acceptance notes

Run individually:

- `npm run lint`
- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`

Delete generated `dist/` after build.

Known unrelated red unless `cr-118-costs` judge re-owner patch is promoted first:

- `src/engine/__tests__/review.grammar-cost.test.ts` still expects
  `"{T}, Pay 3 life: Draw a card."` to be manual, while the implementer `cr-118-costs` slice now
  compiles it as auto with `adjustLife -3`.
