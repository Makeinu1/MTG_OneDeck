import type { GameCommand } from './commands';
import {
  EngineError,
  requirePlayer,
  type CardInstance,
  type GameState,
  type PlayerId,
} from './types';

export const SCENARIO_CARD_TYPES = [
  'Creature',
  'Artifact',
  'Enchantment',
  'Land',
  'Planeswalker',
] as const;

export type ScenarioCardType = (typeof SCENARIO_CARD_TYPES)[number];

export interface ScenarioPermanentDraft {
  draftId: string;
  sourceCardId?: string;
  name: string;
  cardTypes: ScenarioCardType[];
  power: string;
  toughness: string;
  tapped: boolean;
  counters: Record<string, number>;
  keywords: string[];
  isToken: boolean;
}

export interface OpponentSetupDraft {
  playerId: PlayerId;
  /** Canonical editable-state fingerprint captured when this draft was opened. */
  baseFingerprint: string;
  life: number;
  poison: number;
  permanents: ScenarioPermanentDraft[];
}

function editableScenarioState(state: GameState, playerId: PlayerId): object {
  const player = requirePlayer(state, playerId);
  const permanents = state.zones.battlefield.flatMap((cardId) => {
    const card = state.cards[cardId];
    if (
      card?.isScenarioDummy !== true
      || card.ownerId !== playerId
      || card.controllerId !== playerId
    ) {
      return [];
    }
    const permanent = scenarioPermanentFromState(state, card, 0);
    return [{
      sourceCardId: permanent.sourceCardId,
      name: permanent.name,
      cardTypes: permanent.cardTypes,
      power: permanent.power,
      toughness: permanent.toughness,
      tapped: permanent.tapped,
      counters: normalizedCounters(permanent.counters),
      keywords: normalizedKeywords(permanent.keywords),
      isToken: permanent.isToken,
    }];
  });
  return { life: player.life, poison: player.poison, permanents };
}

export function opponentSetupFingerprint(state: GameState, playerId: PlayerId): string {
  return JSON.stringify(editableScenarioState(state, playerId));
}

function typeLineFor(state: GameState, card: CardInstance): string {
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  return face?.typeLine ?? def?.typeLine ?? '';
}

function scenarioTypes(typeLine: string): ScenarioCardType[] {
  return SCENARIO_CARD_TYPES.filter((type) => typeLine.includes(type));
}

function scenarioPermanentFromState(
  state: GameState,
  card: CardInstance,
  index: number,
): ScenarioPermanentDraft {
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  return {
    draftId: `existing-${card.id}-${index}`,
    sourceCardId: card.id,
    name: face?.name ?? def?.name ?? 'ダミー',
    cardTypes: scenarioTypes(typeLineFor(state, card)),
    power: face?.power ?? '0',
    toughness: face?.toughness ?? '0',
    tapped: card.tapped,
    counters: { ...card.counters },
    keywords: card.manualKeywords?.slice() ?? def?.keywords?.slice() ?? [],
    isToken: card.isToken,
  };
}

export function opponentSetupDraftFromState(
  state: GameState,
  playerId: PlayerId,
): OpponentSetupDraft {
  const player = requirePlayer(state, playerId);
  const permanents = state.zones.battlefield.flatMap((cardId, index) => {
    const card = state.cards[cardId];
    return card?.isScenarioDummy === true && card.ownerId === playerId && card.controllerId === playerId
      ? [scenarioPermanentFromState(state, card, index)]
      : [];
  });
  return {
    playerId,
    baseFingerprint: opponentSetupFingerprint(state, playerId),
    life: player.life,
    poison: player.poison,
    permanents,
  };
}

function normalizedTypes(types: readonly ScenarioCardType[]): ScenarioCardType[] {
  const selected = new Set(types);
  return SCENARIO_CARD_TYPES.filter((type) => selected.has(type));
}

function normalizedKeywords(keywords: readonly string[]): string[] {
  return [...new Set(keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean))].sort();
}

function normalizedCounters(counters: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counters)
      .filter(([name, amount]) => name.trim() !== '' && Number.isFinite(amount) && amount > 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, amount]) => [name.trim(), Math.floor(amount)]),
  );
}

function definitionMatches(
  state: GameState,
  card: CardInstance,
  draft: ScenarioPermanentDraft,
): boolean {
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  const cardTypes = normalizedTypes(draft.cardTypes);
  return (face?.name ?? def?.name) === draft.name.trim()
    && typeLineFor(state, card) === cardTypes.join(' ')
    && (cardTypes.includes('Creature') ? face?.power === draft.power.trim() : true)
    && (cardTypes.includes('Creature') ? face?.toughness === draft.toughness.trim() : true)
    && card.isToken === draft.isToken;
}

function nextScenarioIdentity(state: GameState, reserved: Set<string>): { cardId: string; defId: string } {
  let next = 1;
  while (
    state.cards[`scenario-${next}`]
    || state.defs[`scenario-def-${next}`]
    || reserved.has(`scenario-${next}`)
  ) next += 1;
  const cardId = `scenario-${next}`;
  reserved.add(cardId);
  return { cardId, defId: `scenario-def-${next}` };
}

function createCommand(
  state: GameState,
  playerId: PlayerId,
  permanent: ScenarioPermanentDraft,
  reserved: Set<string>,
): Extract<GameCommand, { type: 'createScenarioDummy' }> {
  const cardTypes = normalizedTypes(permanent.cardTypes);
  if (permanent.name.trim() === '' || cardTypes.length === 0) {
    throw new EngineError('ダミーには表示名と1つ以上のカードタイプが必要です。');
  }
  if (
    cardTypes.includes('Creature')
    && (!/^[+-]?\d+$/.test(permanent.power.trim())
      || !/^[+-]?\d+$/.test(permanent.toughness.trim()))
  ) {
    throw new EngineError('クリーチャーの基礎パワー/タフネスには整数を入力してください。');
  }
  const { cardId, defId } = nextScenarioIdentity(state, reserved);
  return {
    type: 'createScenarioDummy',
    cardId,
    defId,
    playerId,
    name: permanent.name.trim(),
    typeLine: cardTypes.join(' '),
    power: permanent.power.trim() || '0',
    toughness: permanent.toughness.trim() || '0',
    tapped: permanent.tapped,
    counters: normalizedCounters(permanent.counters),
    keywords: normalizedKeywords(permanent.keywords),
    isToken: permanent.isToken,
  };
}

export function compileOpponentSetupCommands(
  state: GameState,
  draft: OpponentSetupDraft,
): GameCommand[] {
  if (opponentSetupFingerprint(state, draft.playerId) !== draft.baseFingerprint) {
    throw new EngineError(
      '対戦相手セットアップを開いた後に盤面が変更されました。画面を開き直して再編集してください。',
    );
  }
  const player = requirePlayer(state, draft.playerId);
  if (!Number.isInteger(draft.life) || !Number.isInteger(draft.poison) || draft.poison < 0) {
    throw new EngineError('ライフと毒カウンターには有効な整数を入力してください。');
  }
  const commands: GameCommand[] = [];
  const reserved = new Set<string>();
  const retained = new Set<string>();
  const finalCardIds: string[] = [];

  if (draft.life !== player.life) {
    commands.push({ type: 'adjustLife', playerId: draft.playerId, delta: draft.life - player.life });
  }
  if (draft.poison !== player.poison) {
    commands.push({
      type: 'adjustPlayerCounter',
      playerId: draft.playerId,
      kind: 'poison',
      delta: draft.poison - player.poison,
    });
  }

  for (const permanent of draft.permanents) {
    const existing = permanent.sourceCardId ? state.cards[permanent.sourceCardId] : undefined;
    const canRetain = existing?.isScenarioDummy === true
      && existing.zone === 'battlefield'
      && existing.ownerId === draft.playerId
      && existing.controllerId === draft.playerId
      && definitionMatches(state, existing, permanent);
    if (!canRetain || !existing) {
      if (
        existing?.isScenarioDummy === true
        && existing.zone === 'battlefield'
        && existing.ownerId === draft.playerId
        && existing.controllerId === draft.playerId
      ) {
        commands.push({ type: 'moveCard', cardId: existing.id, to: 'exile', position: 'bottom' });
      }
      const create = createCommand(state, draft.playerId, permanent, reserved);
      commands.push(create);
      finalCardIds.push(create.cardId);
      continue;
    }

    retained.add(existing.id);
    finalCardIds.push(existing.id);
    if (existing.tapped !== permanent.tapped) {
      commands.push({ type: 'setTapped', cardId: existing.id, tapped: permanent.tapped });
    }
    const nextKeywords = normalizedKeywords(permanent.keywords);
    const currentKeywords = normalizedKeywords(existing.manualKeywords ?? []);
    if (JSON.stringify(nextKeywords) !== JSON.stringify(currentKeywords)) {
      commands.push({ type: 'setManualKeywords', cardId: existing.id, keywords: nextKeywords });
    }
    const currentCounters = normalizedCounters(existing.counters);
    const nextCounters = normalizedCounters(permanent.counters);
    for (const counterType of [...new Set([...Object.keys(currentCounters), ...Object.keys(nextCounters)])].sort()) {
      const delta = (nextCounters[counterType] ?? 0) - (currentCounters[counterType] ?? 0);
      if (delta !== 0) {
        commands.push({ type: 'addCounters', cardId: existing.id, counterType, delta });
      }
    }
  }

  for (const cardId of state.zones.battlefield) {
    const card = state.cards[cardId];
    if (
      card?.isScenarioDummy === true
      && card.ownerId === draft.playerId
      && card.controllerId === draft.playerId
      && !retained.has(cardId)
      && !draft.permanents.some((permanent) => permanent.sourceCardId === cardId)
    ) {
      commands.push({ type: 'moveCard', cardId, to: 'exile', position: 'bottom' });
    }
  }

  for (const cardId of finalCardIds) {
    commands.push({ type: 'moveCard', cardId, to: 'battlefield', position: 'bottom' });
  }
  return commands;
}

export function emptyScenarioPermanent(draftId: string): ScenarioPermanentDraft {
  return {
    draftId,
    name: 'ダミー・クリーチャー',
    cardTypes: ['Creature'],
    power: '1',
    toughness: '1',
    tapped: false,
    counters: {},
    keywords: [],
    isToken: false,
  };
}
