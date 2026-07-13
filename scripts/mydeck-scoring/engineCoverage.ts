import {
  compileAbilityCost,
  compileAbilityIR,
  type CompileContext,
  type CompiledEffect,
} from '../../src/engine/grammar/compile.ts';
import { parseAbilityIR, type AbilityIR } from '../../src/engine/grammar/ir.ts';
import { splitAbilityLines, type AbilityLine } from '../../src/engine/grammar/index.ts';
import { cyclingCost, fetchAbility, landEntersTapped } from '../../src/engine/status.ts';
import type { CardDef, ManaColor } from '../../src/types/card';

const EFFECT_FAMILY_BY_ATOM = new Map<string, string>([
  ['effect.draw', 'action:draw'],
  ['effect.mill', 'action:mill'],
  ['effect.sacrifice', 'action:sacrifice'],
  ['effect.destroy', 'action:destroy'],
  ['effect.exile', 'action:exile'],
  ['effect.return', 'action:return'],
  ['effect.discard', 'action:discard'],
  ['effect.search', 'action:search'],
  ['effect.shuffle', 'action:shuffle'],
  ['effect.create-token', 'token:create'],
  ['effect.counter-plus', 'counter:write'],
  ['effect.damage', 'damage:write'],
  ['effect.gain-life', 'life:write'],
  ['effect.lose-life', 'life:write'],
  ['effect.tap', 'tap-state:write'],
  ['effect.untap', 'tap-state:write'],
]);

const COVERAGE_COMMAND_TYPES = new Map<string, string>([
  ['addMana', 'mana:write'],
  ['draw', 'action:draw'],
  ['mill', 'action:mill'],
  ['createToken', 'token:create'],
  ['createDefinedToken', 'token:create'],
  ['adjustCounter', 'counter:write'],
  ['dealDamage', 'damage:write'],
  ['markDamage', 'damage:write'],
  ['adjustLife', 'life:write'],
  ['setTapped', 'tap-state:write'],
]);

const MANA_COLORS = new Set<string>(['W', 'U', 'B', 'R', 'G', 'C']);

// CompileContext deliberately contains only stable card-derived data. The
// scoring tool does not fabricate a GameState or target objects.
function compileContext(card: CardDef, line: AbilityLine): CompileContext {
  return {
    sourceId: `score:${card.scryfallId}:${line.faceIndex}`,
    def: card,
    abilityLineIndex: line.faceIndex,
    commanderColorIdentity: card.colorIdentity.filter(
      (color): color is ManaColor => MANA_COLORS.has(color),
    ),
  };
}

function addEffectCoverage(tags: Set<string>, ir: AbilityIR, compiled: CompiledEffect): void {
  if (compiled.decision === 'manual') {
    return;
  }

  for (const command of compiled.commands) {
    const tag = COVERAGE_COMMAND_TYPES.get(command.type);
    if (tag) {
      tags.add(tag);
    }
  }

  for (const prompt of compiled.prompts) {
    if (prompt.kind === 'target') {
      tags.add('target:object-or-player');
    }
    if (prompt.atom) {
      const tag = EFFECT_FAMILY_BY_ATOM.get(prompt.atom);
      if (tag) {
        tags.add(tag);
      }
      if (prompt.atom === 'effect.search') {
        tags.add('action:shuffle');
      }
      if (prompt.atom === 'effect.add-mana') {
        tags.add('mana:write');
      }
    }
  }

  if (ir.effects.length === 1 && (compiled.commands.length > 0 || compiled.prompts.length > 0)) {
    const tag = EFFECT_FAMILY_BY_ATOM.get(ir.effects[0]?.atom ?? '');
    if (tag) {
      tags.add(tag);
    }
    if (ir.effects[0]?.atom === 'effect.search') {
      tags.add('action:shuffle');
    }
  }
}

// Mirrors the "Search your library for ... onto the battlefield ... shuffle"
// detection src/engine/status.ts detectFetchClause() uses (not exported, so
// duplicated here as a line-local textual gate — see comment below for why a
// duplicate check is needed instead of just calling fetchAbility(card)).
function isFetchClauseLine(line: AbilityLine): boolean {
  return (
    /Search your library for/i.test(line.text) &&
    /onto the battlefield/i.test(line.text) &&
    /\bshuffle\b/i.test(line.text)
  );
}

// Non-ability-compiler engine path: fetch lands (寓話の小道/Fabled Passage,
// classic fetches, Panorama lands, etc.) resolve entirely through
// src/engine/status.ts fetchAbility() + gameStore.ts
// activateFetch/resolveFetch/fetchLand (fetchEntersTapped also implements the
// "Then if you control N or more lands, untap that land" conditional-untap
// clause), independent of compileAbilityIR/compileAbilityCost. The generic
// grammar compiler cannot parse the dual/triple basic-type filter or the
// trailing conditional-untap clause these cards use and falls back to
// 'manual' for the effect body, but the app's dedicated "fetch-activate" UI
// action (src/components/game/actionCatalog.ts, gated the same way:
// typeLine.includes('Land') && fetchAbility(def) !== null) resolves them in
// full regardless of what the ability compiler decided. Credit is gated on
// the SAME real detection fetchAbility() uses (card-level, matching runtime
// exactly — see isFetchAbilityStackItem in src/store/gameStore.ts) AND a
// line-local textual match, so credit attaches only to the ability line that
// is actually the fetch clause and never leaks to a sibling line on the same
// card (per-line separation, §3b-5).
//
// Only tags backed by commands this path *actually* emits are added.
// activateFetch/fetchLand always sacrifice the source (moveCard ->
// graveyard) and resolveFetch/fetchLand always move the chosen library card
// to the battlefield and shuffle — hence action:search/action:shuffle/
// action:sacrifice are unconditional. life:write and tap-state:write are
// gated on the ability actually having a life cost / entering tapped,
// because that is exactly when these commands are emitted (adjustLife /
// setTapped on the fetched card) — see resolveFetch and fetchLand in
// src/store/gameStore.ts. cost:tap/cost:activation/cost:nonmana are
// deliberately NOT added here: this dedicated path sacrifices the source
// directly without ever issuing a setTapped command for it, so those
// cost-side tags are not something *this* path models — they already come
// correctly from compileAbilityCost's own cost-command parse (verified
// covered for every real fetch land's simple cost text).
function addFetchEngineCoverage(
  tags: Set<string>,
  card: CardDef,
  typeLine: string,
  line: AbilityLine,
): void {
  if (!typeLine.includes('Land') || !isFetchClauseLine(line)) {
    return;
  }
  const ability = fetchAbility(card);
  if (!ability) {
    return;
  }
  tags.add('action:search');
  tags.add('action:shuffle');
  tags.add('action:sacrifice');
  if (ability.lifeCost > 0) {
    tags.add('life:write');
  }
  if (ability.entersTapped) {
    tags.add('tap-state:write');
  }
}

// Mirrors the per-sentence "enters ... tapped" detection
// src/engine/status.ts landEntersTapped() uses internally (not exported, so
// duplicated here as a line-local textual gate).
function lineHasEntersTappedClause(line: AbilityLine): boolean {
  return line.text
    .split(/[.\n]/)
    .some((sentence) => /enters\b[\s\S]*\btapped\b/i.test(sentence));
}

// Non-ability-compiler engine path: "this land enters tapped[, unless ...]"
// static clauses (basic taplands, checklands, painless duals, shocklands'
// pay-life-or-tapped framing, etc.) are resolved by src/engine/status.ts
// landEntersTapped() + src/store/gameStore.ts playLand(), entirely
// independent of compileAbilityIR (this line is typically classified as
// 'static'/'replacement' shape, not something the effect compiler touches at
// all). landEntersTapped() returns 'always' (auto-set tapped=true) or
// 'conditional' (playLand() returns 'needs-tap-choice', and the app's
// PendingLandTapChoice dialog lets the player resolve it directly — an
// honest guided choice, not a gap, per the existing you-subject
// draw/sacrifice precedent above). Only 'never' (no matching clause anywhere
// on the card) is left uncredited. Gated on typeLine.includes('Land') and a
// line-local textual match so credit attaches only to the ability line
// that is actually the enters-tapped clause (no leak to a sibling line,
// e.g. a land that also has a "{T}: Add ..." mana line).
function addLandEntersTappedCoverage(
  tags: Set<string>,
  card: CardDef,
  typeLine: string,
  line: AbilityLine,
): void {
  if (!typeLine.includes('Land') || !lineHasEntersTappedClause(line)) {
    return;
  }
  if (landEntersTapped(card) === 'never') {
    return;
  }
  tags.add('tap-state:write');
}

// Non-ability-compiler engine path: mana abilities whose effect body is a
// choice of explicit color symbols ("Add {W} or {B}.", "Add {W}{W}, {W}{B},
// or {B}{B}.", "Add one mana of any color.", etc.) are not compiled by
// compileManaEffect (src/engine/grammar/compile.ts:1206–1231) — it bails to
// 'ambiguous-mana'/'needs-choice' whenever the raw text has an "or"/"any
// combination of" between color symbols. The app never routes these
// permanents through compileAbilityIR at all: src/store/gameStore.ts
// tapForMana() resolves ANY permanent with a non-empty CardDef.producedMana
// (Scryfall's produced_mana field, populated independent of oracle-text
// parsing) through a generic tap+choose-color+addMana flow — the
// 'tapForMana' UI action (src/components/game/actionCatalog.ts) is gated
// purely on producedMana.length > 0. Credit requires producedMana to be
// genuinely populated (so a card with no Scryfall produced-mana data does
// NOT get false credit — tapForMana would tap without adding mana in that
// case) AND the parsed IR to actually contain a mana-add effect on a
// tap-cost activated line (so credit doesn't leak to an unrelated
// activated ability on the same card, and a {0}-cost/non-tap variable-mana
// ability like Vivi Ornitier — which tapForMana cannot resolve, since it
// always taps the source — correctly stays a gap).
function hasParsedManaAddEffect(ir: AbilityIR): boolean {
  return ir.effects.some((effect) => effect.atom === 'effect.add-mana');
}

function addManaAbilityEngineCoverage(
  tags: Set<string>,
  card: CardDef,
  line: AbilityLine,
  ir: AbilityIR,
): void {
  if ((card.producedMana?.length ?? 0) === 0) {
    return;
  }
  if (line.shape !== 'activated' || ir.cost?.tap !== true) {
    return;
  }
  if (!hasParsedManaAddEffect(ir)) {
    return;
  }
  tags.add('mana:write');
}

// Line-local textual gate for the PLAIN "Cycling {cost}" keyword line (CR
// 702.29a). Deliberately requires "cycling" as its own word (\b on both
// sides) so it does NOT match compound keyword-cycling variants printed as a
// single unbroken word — "Basic landcycling {1}" (CR 702.29c) or a
// creature-typecycling line such as "Slivercycling {2}" (CR 702.29d/e).
// Those variants search the library for a specific card and put it into
// hand; they do NOT discard-then-draw. gameStore.ts cycle() (see below)
// unconditionally runs discard+draw for ANY line cyclingCost() matches
// (including landcycling/typecycling — a separate, out-of-scope substrate
// bug this task does not touch), so crediting those variants here would be
// false engine-coverage credit for a family (action:search, not
// action:draw) the line never demands and the app does not correctly
// resolve. Restricting the textual gate to the bare word "Cycling"
// (optionally "Basic Cycling"? — not a real keyword; excluded) keeps credit
// scoped to exactly the lines where discard+draw is the correct resolution.
const PLAIN_CYCLING_LINE_PATTERN = /\bcycling\b\s*(?:\{[^}]+\})+/i;

// Exported so score.ts's demand-generation side can gate the action:draw /
// action:discard demand it adds for a plain cycling line on the EXACT same
// textual test used to gate the engine-coverage credit below — a single
// source of truth prevents the demand side and the coverage side from
// silently drifting apart on which lines qualify (the failure mode this
// repair exists to fix in the first place).
export function isPlainCyclingKeywordLine(line: AbilityLine): boolean {
  return line.shape === 'keyword' && PLAIN_CYCLING_LINE_PATTERN.test(line.text);
}

// Non-ability-compiler engine path: "Cycling {cost}" keyword lines are never
// parsed by compileAbilityIR (a 'keyword'-shape line's raw text — e.g.
// "Cycling {2}" — matches none of ir.ts's effect-atom probes, so the
// ability-compiler path always yields 'manual'/no commands for it, per
// research/cr-grounding/score-ts-demand-catalog-repair.draft.md §8 cluster
// framing). Instead src/components/game/actionCatalog.ts exposes a dedicated
// "cycle" UI action gated purely on status.ts cyclingCost(def) !== null (the
// SAME real detection used here), and src/store/gameStore.ts cycle()
// resolves it unconditionally with payMana + { type: 'discard' } +
// { type: 'draw', count: 1 } (CR 702.29a: "Discard this card: Draw a
// card."). Credit is gated on cyclingCost(card) (card-level, matching
// runtime exactly) AND the line-local plain-"Cycling" textual match above,
// so credit attaches only to the ability line that is actually the plain
// cycling clause and never leaks to a sibling line on the same card
// (per-line separation, §3b-5) or to a landcycling/typecycling line on the
// same or another card. Only action:draw/action:discard are added — the
// mana cost of cycling is an ordinary mana payment, not a family this
// instrument's cost:*/mana:* demands model (those demands only fire for
// 'activated'-shape lines; a 'keyword'-shape cycling line never generates
// them), so no cost:*/mana:* tag is added here.
function addCyclingEngineCoverage(tags: Set<string>, card: CardDef, line: AbilityLine): void {
  if (!isPlainCyclingKeywordLine(line)) {
    return;
  }
  if (cyclingCost(card) === null) {
    return;
  }
  tags.add('action:draw');
  tags.add('action:discard');
}

export function engineCoverageTagsForLine(card: CardDef, line: AbilityLine): Set<string> {
  const tags = new Set<string>();
  const typeLine = card.faces[line.faceIndex]?.typeLine ?? card.typeLine;
  const ir = parseAbilityIR(line.text, typeLine);
  const ctx = compileContext(card, line);
  const compiled = compileAbilityIR(ir, ctx);
  const cost = compileAbilityCost(ir.cost ?? null, ctx);

  addEffectCoverage(tags, ir, compiled);
  // Cost commands are NOT mapped through COVERAGE_COMMAND_TYPES (the effect-family
  // map). A cost that taps the source (`{T}` → setTapped) or pays life
  // (adjustLife) is a COST, not an effect that taps/untaps a permanent or
  // gains/loses life — crediting it as `tap-state:write` / `life:write` is the
  // symmetric twin of the demand-side `{T}`→tap-state:write mis-tag fixed in
  // score.ts (addEffectDemands scopes those families to effectText). Leaving the
  // coverage side crediting them from the cost would make the two sides
  // asymmetric and could falsely cover a genuine effect-side tap/untap gap on a
  // line that also happens to carry a `{T}` cost (over-credit — the instrument's
  // worst failure). Every LEGITIMATE cost credit is issued explicitly below:
  // cost:activation, cost:tap, cost:nonmana, and cost-form action:sacrifice /
  // action:exile. Effect-family tags come only from the effect side
  // (addEffectCoverage) and the dedicated engine-path functions.
  // A line can contain independently supported and unsupported effects (the
  // colored Talisman ability is the common example). Compile each parsed atom
  // through the same runtime compiler so one manual sibling cannot hide the
  // concrete command or guided prompt produced for another family.
  if (ir.effects.length > 1) {
    for (const effect of ir.effects) {
      const singleEffectIR: AbilityIR = { ...ir, effects: [effect], modal: undefined };
      addEffectCoverage(tags, singleEffectIR, compileAbilityIR(singleEffectIR, ctx));
    }
  }
  // The runtime resolves a modal prompt by parsing each option's clean `raw`
  // text independently (gameStore.compileSelectedModalOptions).
  for (const option of ir.modal?.options ?? []) {
    const optionIR = parseAbilityIR(option.raw, typeLine);
    addEffectCoverage(tags, optionIR, compileAbilityIR(optionIR, ctx));
  }

  if (line.shape === 'activated' && cost.decision !== 'manual') {
    tags.add('cost:activation');
  }
  if (ir.cost?.tap && cost.decision !== 'manual') {
    tags.add('cost:tap');
  }
  if (
    cost.decision !== 'manual' &&
    cost.commands.some((command) => command.type === 'moveCard' && command.to === 'graveyard')
  ) {
    tags.add('action:sacrifice');
  }
  if (
    cost.decision !== 'manual' &&
    cost.commands.some((command) => command.type === 'moveCard' && command.to === 'exile')
  ) {
    tags.add('action:exile');
  }
  if (
    cost.decision !== 'manual' &&
    cost.commands.some((command) =>
      command.type === 'setTapped' ||
      command.type === 'adjustLife' ||
      command.type === 'moveCard'
    )
  ) {
    tags.add('cost:nonmana');
  }

  addFetchEngineCoverage(tags, card, typeLine, line);
  addLandEntersTappedCoverage(tags, card, typeLine, line);
  addManaAbilityEngineCoverage(tags, card, line, ir);
  addCyclingEngineCoverage(tags, card, line);

  return tags;
}

// Compile every ability line through the runtime compiler and return the union
// of demand-family tags for which it emits commands or guided prompts.
export function engineCoverageTags(card: CardDef): Set<string> {
  const tags = new Set<string>();
  for (const line of splitAbilityLines(card)) {
    for (const tag of engineCoverageTagsForLine(card, line)) {
      tags.add(tag);
    }
  }
  return tags;
}
