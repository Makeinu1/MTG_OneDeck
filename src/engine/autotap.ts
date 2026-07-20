import type { ManaColor } from '../types/card';
import type { GameCommand } from './commands';
import { compileAbilityCost } from './grammar/compile';
import { splitAbilityLines } from './grammar/index';
import { parseAbilityIR } from './grammar/ir';
import {
  hasActivatedAddManaLine,
  intrinsicBasicLandColors,
  manaOutputsForAddManaClause,
  naiveTapManaOutputs,
} from './grammar/manaShortcut';
import { parseManaCost, type ParsedCost, solvePayment } from './mana';
import { isSummoningSick } from './status';
import type { GameState, ManaPool, PlayerId } from './types';

export interface AutoTapPlan {
  ok: boolean;
  taps: { cardId: string; color: ManaColor }[];
  activations: AutoTapActivation[];
  payment: ManaPool;
  shortfall: number;
}

export interface AutoTapActivation {
  cardId: string;
  mana: ManaPool;
  abilityLineIndex?: number;
  commands?: GameCommand[];
}

interface SourceOption {
  output: ManaPool;
  abilityLineIndex?: number;
  activationCost: ParsedCost | null;
  costCommands: GameCommand[];
  effectCommands: GameCommand[];
  drawbackPriority: number;
}

interface Source {
  cardId: string;
  colors: ManaColor[];
  options: SourceOption[];
  requiresMana: boolean;
  drawbackPriority: number;
  typePriority: number;
  coverageLoss: number;
  scarcityScore: number;
}

interface RankedPlan extends AutoTapPlan {
  candidateIndexes: number[];
}

const ALL_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

function dedupeColors(colors: readonly ManaColor[]): ManaColor[] {
  return [...new Set(colors)];
}

function emptyPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

function addPool(base: ManaPool, extra: ManaPool): ManaPool {
  return {
    W: base.W + extra.W,
    U: base.U + extra.U,
    B: base.B + extra.B,
    R: base.R + extra.R,
    G: base.G + extra.G,
    C: base.C + extra.C,
  };
}

function subtractPool(base: ManaPool, payment: ManaPool): ManaPool {
  return {
    W: base.W - payment.W,
    U: base.U - payment.U,
    B: base.B - payment.B,
    R: base.R - payment.R,
    G: base.G - payment.G,
    C: base.C - payment.C,
  };
}

function normalizedPool(output: Partial<Record<ManaColor, number>>): ManaPool {
  return {
    W: output.W ?? 0,
    U: output.U ?? 0,
    B: output.B ?? 0,
    R: output.R ?? 0,
    G: output.G ?? 0,
    C: output.C ?? 0,
  };
}

function poolTotal(pool: ManaPool): number {
  return pool.W + pool.U + pool.B + pool.R + pool.G + pool.C;
}

function compareIndexLists(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

function isLand(typeLine: string): boolean {
  return typeLine.includes('Land');
}

function isCreature(typeLine: string): boolean {
  return typeLine.includes('Creature');
}

function candidateTypePriority(typeLine: string): number {
  if (isLand(typeLine)) {
    return 0;
  }
  if (!isCreature(typeLine)) {
    return 1;
  }
  return 2;
}

function currentTypeLine(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return '';
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  return face?.typeLine ?? def?.typeLine ?? '';
}

function commanderColors(state: GameState): ManaColor[] {
  const colors = new Set<ManaColor>();
  for (const commander of state.commanders) {
    const card = state.cards[commander.cardId];
    const def = card ? state.defs[card.defId] : undefined;
    for (const color of def?.colorIdentity ?? []) {
      if (ALL_COLORS.includes(color as ManaColor) && color !== 'C') {
        colors.add(color as ManaColor);
      }
    }
  }
  return ALL_COLORS.filter((color) => colors.has(color));
}

function controlsLandType(state: GameState, playerId: PlayerId, landType: string): boolean {
  const probe = new RegExp(`\\b${landType}\\b`);
  return state.zones.battlefield.some((cardId) => {
    const card = state.cards[cardId];
    return card?.controllerId === playerId && probe.test(currentTypeLine(state, cardId));
  });
}

function colorsInManaCost(manaCost: string | undefined): ManaColor[] {
  if (!manaCost) return [];
  const colors: ManaColor[] = [];
  for (const pip of parseManaCost(manaCost).pips) {
    if (pip.kind === 'color' || pip.kind === 'monoHybrid' || pip.kind === 'phyrexian') {
      colors.push(pip.color);
    } else if (pip.kind === 'hybrid') {
      colors.push(...pip.options.filter((color) => color !== 'C'));
    }
  }
  return dedupeColors(colors);
}

function legendaryPermanentColors(
  state: GameState,
  playerId: PlayerId,
  creaturesAndPlaneswalkersOnly: boolean,
): ManaColor[] {
  return dedupeColors(
    state.zones.battlefield.flatMap((cardId) => {
      const card = state.cards[cardId];
      if (!card || card.controllerId !== playerId) return [];
      const typeLine = currentTypeLine(state, cardId);
      if (!/\bLegendary\b/.test(typeLine)) return [];
      if (creaturesAndPlaneswalkersOnly && !/\b(?:Creature|Planeswalker)\b/.test(typeLine)) {
        return [];
      }
      const def = state.defs[card.defId];
      const face = def?.faces[card.faceIndex] ?? def?.faces[0];
      return colorsInManaCost(face?.manaCost);
    }),
  );
}

function automaticSacrificeCreatureId(
  state: GameState,
  playerId: PlayerId,
): string | null {
  const battlefieldOrder = new Map(
    state.zones.battlefield.map((cardId, index) => [cardId, index]),
  );
  const candidates = state.zones.battlefield.filter((cardId) => {
    const card = state.cards[cardId];
    return card?.controllerId === playerId && /\bCreature\b/.test(currentTypeLine(state, cardId));
  });
  candidates.sort((leftId, rightId) => {
    const left = state.cards[leftId];
    const right = state.cards[rightId];
    if (left.isToken !== right.isToken) return left.isToken ? -1 : 1;
    if (left.isCommander !== right.isCommander) return left.isCommander ? 1 : -1;
    const leftCmc = state.defs[left.defId]?.cmc ?? 0;
    const rightCmc = state.defs[right.defId]?.cmc ?? 0;
    if (leftCmc !== rightCmc) return leftCmc - rightCmc;
    return (battlefieldOrder.get(leftId) ?? 0) - (battlefieldOrder.get(rightId) ?? 0);
  });
  return candidates[0] ?? null;
}

function compiledManaOptions(
  state: GameState,
  cardId: string,
  playerId: PlayerId,
): SourceOption[] {
  const card = state.cards[cardId];
  const def = card ? state.defs[card.defId] : undefined;
  if (!card || !def) return [];

  return splitAbilityLines(def).flatMap((line, abilityLineIndex) => {
    if (line.shape !== 'activated') return [];
    const typeLine = def.faces[line.faceIndex]?.typeLine ?? def.typeLine;
    const ir = parseAbilityIR(line.text, typeLine);
    if (!ir.effects.some((effect) => effect.atom === 'effect.add-mana')) return [];
    const swampGate = /\bActivate only if you control a Swamp\b/i.test(line.text);
    if (swampGate && !controlsLandType(state, playerId, 'Swamp')) return [];
    const chargeCounterOutput = /\bAdd \{C\} for each charge counter on (?:this artifact|[^.]+)\b/i.test(
      line.text,
    );
    const legendaryColorGate = /\bAdd one mana of any color among legendary (creatures and planeswalkers|permanents) you control\b/i.exec(
      line.text,
    );
    if (
      ((!swampGate && /\bActivate only\b/i.test(line.text)) ||
      /\bSpend this mana only\b|\bwhere X\b|\bequal to\b/i.test(
        line.text,
      ) || (!chargeCounterOutput && /\bfor each\b/i.test(line.text)))
    ) return [];

    const sacrificeCreatureCost = /(?:^|,)\s*Sacrifice (?:a|one) creature\s*(?:,|$)/i.test(
      ir.cost?.raw ?? '',
    );
    const sacrificeCreatureId = sacrificeCreatureCost
      ? automaticSacrificeCreatureId(state, playerId)
      : null;
    if (sacrificeCreatureCost && !sacrificeCreatureId) return [];
    const compiledCost = sacrificeCreatureCost && sacrificeCreatureId
      ? {
          decision: 'auto' as const,
          manaCost: ir.cost?.mana ?? null,
          commands: [
            ...(ir.cost?.tap
              ? [{ type: 'setTapped', cardId, tapped: true } satisfies GameCommand]
              : []),
            {
              type: 'moveCard',
              cardId: sacrificeCreatureId,
              to: 'graveyard',
              position: 'top',
              reason: 'sacrifice',
            } satisfies GameCommand,
          ],
        }
      : compileAbilityCost(ir.cost, {
          sourceId: cardId,
          def,
          controllerId: playerId,
          commanderColorIdentity: commanderColors(state),
        });
    if (compiledCost.decision === 'manual') return [];

    let outputs = ir.effects
      .filter((effect) => effect.atom === 'effect.add-mana')
      .flatMap((effect) => manaOutputsForAddManaClause(effect.raw, def))
      .map(normalizedPool)
      .filter((pool) => poolTotal(pool) > 0);
    if (chargeCounterOutput) {
      const amount = Math.max(0, card.counters.charge ?? 0);
      outputs = amount > 0 ? [normalizedPool({ C: amount })] : [];
    }
    if (legendaryColorGate) {
      const allowed = new Set(
        legendaryPermanentColors(
          state,
          playerId,
          legendaryColorGate[1].toLowerCase() !== 'permanents',
        ),
      );
      outputs = outputs.filter((output) =>
        ALL_COLORS.some((color) => output[color] > 0 && allowed.has(color)),
      );
    }
    if (/commander's color identity|color identity of your commander/i.test(line.text)) {
      const identity = new Set(commanderColors(state));
      outputs = outputs.filter((output) =>
        ALL_COLORS.some((color) => output[color] > 0 && identity.has(color)),
      );
    }
    if (outputs.length === 0) return [];

    const selfDamage = /\b(?:this land|this artifact|[\w' -]+) deals (\d+) damage to you\b/i.exec(
      line.text,
    );
    const effectCommands: GameCommand[] = selfDamage
      ? [{
          type: 'dealDamage',
          sourceId: cardId,
          amount: Number.parseInt(selfDamage[1], 10),
          combatDamage: false,
          targetPlayerId: playerId,
        }]
      : [];
    const sacrificesOrExiles = compiledCost.commands.some(
      (command) =>
        command.type === 'moveCard' &&
        (command.to === 'graveyard' || command.to === 'exile'),
    );
    const paysLife = compiledCost.commands.some(
      (command) => command.type === 'adjustLife' && command.delta < 0,
    );
    const drawbackPriority = sacrificesOrExiles ? 3 : paysLife || selfDamage ? 2 : 0;
    const activationCost = compiledCost.manaCost === null
      ? null
      : parseManaCost(compiledCost.manaCost);

    return outputs.map((output) => ({
      output,
      abilityLineIndex,
      activationCost,
      costCommands: compiledCost.commands,
      effectCommands,
      drawbackPriority,
    }));
  });
}

function buildSources(state: GameState, playerId: PlayerId, includeCosted: boolean): Source[] {
  const battlefieldOrder = new Map<string, number>(
    state.zones.battlefield.map((cardId, index) => [cardId, index])
  );

  const sources = state.zones.battlefield
    .map((cardId) => {
      const card = state.cards[cardId];
      if (
        !card ||
        card.controllerId !== playerId ||
        card.tapped ||
        isSummoningSick(state, cardId)
      ) return null;
      const def = state.defs[card.defId];
      const simpleOutputs = includeCosted && hasActivatedAddManaLine(def)
        ? intrinsicBasicLandColors(def).map((color) => ({ [color]: 1 }))
        : naiveTapManaOutputs(def);
      const simpleOptions: SourceOption[] = simpleOutputs
        .map(normalizedPool)
        .filter((pool) => poolTotal(pool) > 0)
        .map((output) => ({
          output,
          activationCost: null,
          costCommands: [{ type: 'setTapped', cardId, tapped: true }],
          effectCommands: [],
          drawbackPriority: 0,
        }));
      const options = [
        ...simpleOptions,
        ...(includeCosted ? compiledManaOptions(state, cardId, playerId) : []),
      ];
      const optionColors = dedupeColors(
        options.flatMap((option) =>
          ALL_COLORS.filter((color) => option.output[color] > 0),
        ),
      );
      if (optionColors.length === 0 || def?.tokenKind === 'treasure') return null;
      const typeLine = currentTypeLine(state, cardId);
      return {
        cardId,
        colors: optionColors,
        options,
        requiresMana: options.every((option) => option.activationCost !== null),
        drawbackPriority: Math.min(...options.map((option) => option.drawbackPriority)),
        typePriority: candidateTypePriority(typeLine),
        coverageLoss: 0,
        scarcityScore: 0,
      } satisfies Source;
    })
    .filter((source): source is Source => source !== null);

  const supplyCounts = colorSupplyCounts(sources);
  for (const source of sources) {
    source.coverageLoss = source.colors.filter((color) => supplyCounts[color] === 1).length;
    source.scarcityScore = source.colors.reduce(
      (total, color) => total + 1 / supplyCounts[color],
      0,
    );
  }

  sources.sort((left, right) => {
    // Preserve future options before considering card type. A source that is the
    // battlefield's only way to make a color is more valuable untapped than an
    // otherwise equivalent redundant source. This also naturally keeps rainbow
    // lands until narrower sources can no longer complete the payment.
    if (left.drawbackPriority !== right.drawbackPriority) {
      return left.drawbackPriority - right.drawbackPriority;
    }
    if (left.requiresMana !== right.requiresMana) return left.requiresMana ? 1 : -1;
    if (left.coverageLoss !== right.coverageLoss) {
      return left.coverageLoss - right.coverageLoss;
    }
    if (left.scarcityScore !== right.scarcityScore) {
      return left.scarcityScore - right.scarcityScore;
    }
    if (left.colors.length !== right.colors.length) return left.colors.length - right.colors.length;
    if (left.typePriority !== right.typePriority) return left.typePriority - right.typePriority;
    return (battlefieldOrder.get(left.cardId) ?? 0) - (battlefieldOrder.get(right.cardId) ?? 0);
  });

  return sources;
}

function colorSupplyCounts(sources: Source[]): Record<ManaColor, number> {
  const counts = emptyPool();
  for (const source of sources) {
    for (const color of source.colors) {
      counts[color] += 1;
    }
  }
  return counts;
}

function orderedColorOptions(
  colors: ManaColor[],
  supplyCounts: Record<ManaColor, number>
): ManaColor[] {
  return colors.slice().sort((left, right) => {
    const supplyDiff = supplyCounts[left] - supplyCounts[right];
    if (supplyDiff !== 0) return supplyDiff;
    return ALL_COLORS.indexOf(left) - ALL_COLORS.indexOf(right);
  });
}

function representativeColor(output: ManaPool): ManaColor {
  return ALL_COLORS.find((color) => output[color] > 0) ?? 'C';
}

function orderedOptions(
  source: Source,
  supplyCounts: Record<ManaColor, number>,
): SourceOption[] {
  const colorOrder = orderedColorOptions(source.colors, supplyCounts);
  return source.options.slice().sort((left, right) => {
    if (left.drawbackPriority !== right.drawbackPriority) {
      return left.drawbackPriority - right.drawbackPriority;
    }
    const leftColor = representativeColor(left.output);
    const rightColor = representativeColor(right.output);
    return colorOrder.indexOf(leftColor) - colorOrder.indexOf(rightColor);
  });
}

function betterPlan(
  candidate: RankedPlan,
  best: RankedPlan,
  preferFewerActivations: boolean,
): boolean {
  if (candidate.shortfall !== best.shortfall) {
    return candidate.shortfall < best.shortfall;
  }

  if (preferFewerActivations && candidate.taps.length !== best.taps.length) {
    return candidate.taps.length < best.taps.length;
  }

  const byIndex = compareIndexLists(candidate.candidateIndexes, best.candidateIndexes);
  if (byIndex !== 0) return byIndex < 0;

  if (candidate.taps.length !== best.taps.length) {
    return candidate.taps.length < best.taps.length;
  }

  return poolTotal(candidate.payment) < poolTotal(best.payment);
}

function planManaPayment(
  state: GameState,
  cost: ParsedCost,
  xValue: number,
  playerId: PlayerId,
  includeCosted: boolean,
): AutoTapPlan {
  const player = state.players[playerId];
  const manaPool = playerId === state.localPlayerId ? state.manaPool : player?.manaPool ?? emptyPool();
  const baseSolution = solvePayment(manaPool, cost, xValue);
  let best: RankedPlan = {
    ok: baseSolution.ok,
    taps: [],
    activations: [],
    payment: baseSolution.payment,
    shortfall: baseSolution.shortfall,
    candidateIndexes: [],
  };

  if (baseSolution.ok) {
    return best;
  }

  const sources = buildSources(state, playerId, includeCosted);
  if (sources.length === 0) {
    return best;
  }

  const supplyCounts = colorSupplyCounts(sources);
  const optimizeActivationCount = includeCosted && sources.some((source) =>
    source.options.some(
      (option) =>
        option.activationCost !== null ||
        option.drawbackPriority > 0 ||
        poolTotal(option.output) > 1,
    ),
  );
  // A filter/signet activation can require one preparatory source, so activation
  // depth is allowed to exceed the spell's raw shortfall by a small bounded amount.
  const maxUsefulTaps = Math.min(
    sources.length,
    baseSolution.shortfall + (optimizeActivationCount ? 3 : 0),
  );
  const taps: { cardId: string; color: ManaColor }[] = [];
  const activations: AutoTapActivation[] = [];
  const candidateIndexes: number[] = [];
  // DFS visits source indexes in ascending (priority) order, so the FIRST
  // complete plan found is already the lexicographically-best one. Stop the
  // whole search there — exploring equal-shortfall siblings is exponential.
  let foundComplete = false;
  let bestCompleteTapCount = Number.POSITIVE_INFINITY;

  const search = (startIndex: number, currentPool: ManaPool): void => {
    const solution = solvePayment(currentPool, cost, xValue);
    const candidatePlan: RankedPlan = {
      ok: solution.ok,
      taps: taps.slice(),
      activations: activations.slice(),
      payment: solution.payment,
      shortfall: solution.shortfall,
      candidateIndexes: candidateIndexes.slice(),
    };
    if (betterPlan(candidatePlan, best, optimizeActivationCount)) {
      best = candidatePlan;
    }

    if (solution.shortfall === 0) {
      bestCompleteTapCount = Math.min(bestCompleteTapCount, taps.length);
      foundComplete = !optimizeActivationCount;
      return;
    }
    if (taps.length >= maxUsefulTaps || taps.length >= bestCompleteTapCount) {
      return;
    }

    const remainingSlots = Math.min(
      maxUsefulTaps - taps.length,
      Number.isFinite(bestCompleteTapCount)
        ? bestCompleteTapCount - taps.length - 1
        : maxUsefulTaps - taps.length,
    );
    const optimisticOutput = sources
      .slice(startIndex)
      .map((source) => Math.max(...source.options.map((option) => poolTotal(option.output))))
      .sort((left, right) => right - left)
      .slice(0, Math.max(0, remainingSlots))
      .reduce((total, amount) => total + amount, 0);
    if (Number.isFinite(bestCompleteTapCount) && optimisticOutput < solution.shortfall) return;

    for (let sourceIndex = startIndex; sourceIndex < sources.length; sourceIndex++) {
      const source = sources[sourceIndex];
      for (const option of orderedOptions(source, supplyCounts)) {
        const activationPayment = option.activationCost
          ? solvePayment(currentPool, option.activationCost, 0)
          : { ok: true, payment: emptyPool(), shortfall: 0 };
        if (!activationPayment.ok) continue;

        const afterCost = subtractPool(currentPool, activationPayment.payment);
        const nextPool = addPool(afterCost, option.output);
        const commands: GameCommand[] = [
          ...option.costCommands,
          ...(option.activationCost
            ? [{
                type: 'payMana',
                payment: activationPayment.payment,
                ...(playerId !== 'P1' ? { playerId } : {}),
              } satisfies GameCommand]
            : []),
          ...commandsForManaOutput(option.output, playerId),
          ...option.effectCommands,
        ];
        taps.push({ cardId: source.cardId, color: representativeColor(option.output) });
        const usesNaiveTapCommands =
          option.activationCost === null &&
          option.effectCommands.length === 0 &&
          option.costCommands.length === 1 &&
          option.costCommands[0]?.type === 'setTapped';
        activations.push({
          cardId: source.cardId,
          mana: option.output,
          ...(option.abilityLineIndex === undefined
            ? {}
            : { abilityLineIndex: option.abilityLineIndex }),
          ...(usesNaiveTapCommands ? {} : { commands }),
        });
        candidateIndexes.push(sourceIndex);
        search(sourceIndex + 1, nextPool);
        candidateIndexes.pop();
        activations.pop();
        taps.pop();
        if (foundComplete) return;
      }
    }
  };

  search(0, manaPool);

  return {
    ok: best.ok,
    taps: best.taps,
    activations: best.activations,
    payment: best.payment,
    shortfall: best.shortfall,
  };
}

/** Pure `{T}` shortcut planner retained for callers that must not pay extra costs. */
export function planAutoTap(
  state: GameState,
  cost: ParsedCost,
  xValue: number,
  playerId: PlayerId = state.localPlayerId,
): AutoTapPlan {
  return planManaPayment(state, cost, xValue, playerId, false);
}

/** Cast/payment planner that may activate costed mana abilities atomically. */
export function planAutoManaPayment(
  state: GameState,
  cost: ParsedCost,
  xValue: number,
  playerId: PlayerId = state.localPlayerId,
): AutoTapPlan {
  return planManaPayment(state, cost, xValue, playerId, true);
}

/** Commands matching the exact mana bundles selected by planAutoTap. */
export function autoTapCommands(
  plan: Pick<AutoTapPlan, 'activations'>,
  playerId?: PlayerId,
): GameCommand[] {
  return plan.activations.flatMap((activation) => {
    if (activation.commands) return activation.commands;
    return [
      { type: 'setTapped', cardId: activation.cardId, tapped: true } satisfies GameCommand,
      ...commandsForManaOutput(activation.mana, playerId),
    ];
  });
}

function commandsForManaOutput(output: ManaPool, playerId?: PlayerId): GameCommand[] {
  return ALL_COLORS.flatMap((color) => {
    const amount = output[color];
    return amount > 0
      ? [{
          type: 'addMana',
          color,
          amount,
          ...(playerId && playerId !== 'P1' ? { playerId } : {}),
        } satisfies GameCommand]
      : [];
  });
}
