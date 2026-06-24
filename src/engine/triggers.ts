import { classifyCardRules } from '../data/ruleClassifier';
import { splitAbilityLines, type AbilityShape } from './grammar/index';
import type { AbilityKind, GameState } from './types';

const LAND_ENTERS_TRIGGER_PATTERN =
  /\b(?:when|whenever)\b\s+(?:(?:a|one or more)\s+lands?)\b(?:\s+you control)?\s+enters?\b/i;
const BATTLEFIELD_TO_GRAVEYARD_PATTERN =
  /\b(?:is|are)\s+put\s+into\s+(?:a|an|the|your|their|its owner's|an opponent's)?\s*graveyard\s+from\s+the battlefield\b/i;
const LEAVES_BATTLEFIELD_PATTERN = /\bleaves?\s+the battlefield\b/i;

export interface TriggerCandidate {
  sourceId: string;
  triggerId: string;
  label: string;
  abilityLineIndex?: number;
}

function cardLabel(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return '《不明なカード》';
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  const name =
    face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明なカード';
  return `《${name}》`;
}

function cardHasRuleTag(state: GameState, cardId: string, tagId: string): boolean {
  const card = state.cards[cardId];
  if (!card) return false;
  const def = state.defs[card.defId];
  if (!def) return false;
  return classifyCardRules(def).some((tag) => tag.id === tagId);
}

function abilityShapesForKind(kind: AbilityKind): AbilityShape[] {
  return kind === 'activated' ? ['activated'] : ['triggered', 'delayed-triggered'];
}

export function abilityLineIndexForKind(
  state: GameState,
  sourceId: string,
  kind: AbilityKind,
): number | undefined {
  const card = state.cards[sourceId];
  if (!card) return undefined;
  const def = state.defs[card.defId];
  if (!def) return undefined;

  const shapes = abilityShapesForKind(kind);
  const matches = splitAbilityLines(def)
    .map((line, index) => ({ line, index }))
    .filter((entry) => shapes.includes(entry.line.shape));

  return matches.length === 1 ? matches[0].index : undefined;
}

function abilityLineIndexForTrigger(
  state: GameState,
  sourceId: string,
  triggerId: string,
): number | undefined {
  const card = state.cards[sourceId];
  if (!card) return undefined;
  const def = state.defs[card.defId];
  if (!def) return undefined;

  const triggerMatches = splitAbilityLines(def)
    .map((line, index) => ({ line, index }))
    .filter((entry) => {
      if (entry.line.shape !== 'triggered' && entry.line.shape !== 'delayed-triggered') {
        return false;
      }
      const text = entry.line.text;
      switch (triggerId) {
        case 'trigger.etb':
          return /\benters\b/i.test(text);
        case 'trigger.etb-other':
          return /\benters\b/i.test(text) && /\b(?:another|other)\b/i.test(text);
        case 'trigger.death':
        case 'trigger.death-other':
          return /\bdies\b/i.test(text) || BATTLEFIELD_TO_GRAVEYARD_PATTERN.test(text);
        case 'trigger.leaves':
        case 'trigger.leaves-other':
          return (
            LEAVES_BATTLEFIELD_PATTERN.test(text) ||
            BATTLEFIELD_TO_GRAVEYARD_PATTERN.test(text)
          );
        case 'trigger.landfall':
          return /\blandfall\b/i.test(text) || LAND_ENTERS_TRIGGER_PATTERN.test(text);
        case 'trigger.upkeep':
          return /\bupkeep\b/i.test(text);
        case 'trigger.end-step':
          return /\bend step\b/i.test(text);
        case 'trigger.draw':
          return /\bdraw\b/i.test(text);
        case 'trigger.cast':
        case 'trigger.cast-watcher':
          return /\bcast\b/i.test(text);
        case 'trigger.attack':
        case 'trigger.attack-watcher':
          return /\battack/i.test(text);
        default:
          return false;
      }
    });

  if (triggerMatches.length === 1) {
    return triggerMatches[0].index;
  }
  return abilityLineIndexForKind(state, sourceId, 'triggered');
}

function makeTriggerCandidate(
  state: GameState,
  sourceId: string,
  triggerId: string,
  label: string,
): TriggerCandidate {
  const candidate: TriggerCandidate = {
    sourceId,
    triggerId,
    label: `${label}: ${cardLabel(state, sourceId)}`,
  };
  const abilityLineIndex = abilityLineIndexForTrigger(state, sourceId, triggerId);
  if (abilityLineIndex !== undefined) {
    Object.defineProperty(candidate, 'abilityLineIndex', {
      value: abilityLineIndex,
      enumerable: false,
      configurable: true,
    });
  }
  return candidate;
}

function addTriggerCandidate(
  candidates: TriggerCandidate[],
  candidate: TriggerCandidate,
): void {
  const duplicate = candidates.some(
    (existing) =>
      existing.sourceId === candidate.sourceId && existing.triggerId === candidate.triggerId,
  );
  if (!duplicate) {
    candidates.push(candidate);
  }
}

export function detectTriggerCandidates(
  prev: GameState,
  next: GameState,
): TriggerCandidate[] | null {
  const candidates: TriggerCandidate[] = [];
  let sawTriggerEvent = false;

  const prevBattlefield = new Set(prev.zones.battlefield);
  const nextBattlefield = new Set(next.zones.battlefield);
  const nextGraveyard = new Set(next.zones.graveyard);
  const isLandfallEvent = next.landsPlayedThisTurn > prev.landsPlayedThisTurn;

  const enteredBattlefield = next.zones.battlefield.filter(
    (cardId) => !prevBattlefield.has(cardId),
  );
  if (enteredBattlefield.length > 0) {
    sawTriggerEvent = true;
    const enteredBattlefieldSet = new Set(enteredBattlefield);
    for (const cardId of enteredBattlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.etb')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.etb', '戦場に出たとき'),
      );
    }
    for (const cardId of next.zones.battlefield) {
      if (enteredBattlefieldSet.has(cardId)) continue;
      if (isLandfallEvent && cardHasRuleTag(next, cardId, 'trigger.landfall')) continue;
      if (!cardHasRuleTag(next, cardId, 'trigger.etb-other')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.etb-other', '他が戦場に出たとき'),
      );
    }
  }

  const died = prev.zones.battlefield.filter(
    (cardId) => !nextBattlefield.has(cardId) && nextGraveyard.has(cardId),
  );
  if (died.length > 0) {
    sawTriggerEvent = true;
    for (const cardId of died) {
      if (cardHasRuleTag(next, cardId, 'trigger.death')) {
        addTriggerCandidate(
          candidates,
          makeTriggerCandidate(next, cardId, 'trigger.death', '死亡したとき'),
        );
      }
      if (cardHasRuleTag(next, cardId, 'trigger.leaves')) {
        addTriggerCandidate(
          candidates,
          makeTriggerCandidate(next, cardId, 'trigger.leaves', '戦場を離れたとき'),
        );
      }
    }
    for (const cardId of next.zones.battlefield) {
      if (cardHasRuleTag(next, cardId, 'trigger.death-other')) {
        addTriggerCandidate(
          candidates,
          makeTriggerCandidate(next, cardId, 'trigger.death-other', '他の死亡時'),
        );
      }
      if (cardHasRuleTag(next, cardId, 'trigger.leaves-other')) {
        addTriggerCandidate(
          candidates,
          makeTriggerCandidate(next, cardId, 'trigger.leaves-other', '他が戦場を離れたとき'),
        );
      }
    }
  }

  if (isLandfallEvent) {
    sawTriggerEvent = true;
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.landfall')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.landfall', '上陸'),
      );
    }
  }

  if (prev.phase !== 'upkeep' && next.phase === 'upkeep') {
    sawTriggerEvent = true;
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.upkeep')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.upkeep', 'アップキープ開始時'),
      );
    }
  }

  if (prev.phase !== 'end' && next.phase === 'end') {
    sawTriggerEvent = true;
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.end-step')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.end-step', 'エンドステップ開始時'),
      );
    }
  }

  if (next.drawnThisTurn > prev.drawnThisTurn) {
    sawTriggerEvent = true;
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.draw')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.draw', 'カードを引いたとき'),
      );
    }
  }

  if (next.spellsCastThisTurn > prev.spellsCastThisTurn) {
    sawTriggerEvent = true;
    const prevStack = new Set(prev.zones.stack);
    const topStackId = next.zones.stack[next.zones.stack.length - 1];
    const topStackCard = topStackId ? next.cards[topStackId] : undefined;
    if (topStackId && topStackCard && !topStackCard.isAbility && !prevStack.has(topStackId)) {
      if (cardHasRuleTag(next, topStackId, 'trigger.cast')) {
        addTriggerCandidate(
          candidates,
          makeTriggerCandidate(next, topStackId, 'trigger.cast', '唱えたとき'),
        );
      }
    }
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.cast-watcher')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.cast-watcher', '呪文を唱えるたび'),
      );
    }
  }

  return sawTriggerEvent ? candidates : null;
}

export function detectAttackTriggerCandidates(
  state: GameState,
  attackerIds: string[],
): TriggerCandidate[] {
  const candidates: TriggerCandidate[] = [];

  for (const cardId of attackerIds) {
    if (!cardHasRuleTag(state, cardId, 'trigger.attack')) continue;
    addTriggerCandidate(
      candidates,
      makeTriggerCandidate(state, cardId, 'trigger.attack', '攻撃したとき'),
    );
  }

  for (const cardId of state.zones.battlefield) {
    if (!cardHasRuleTag(state, cardId, 'trigger.attack-watcher')) continue;
    addTriggerCandidate(
      candidates,
      makeTriggerCandidate(state, cardId, 'trigger.attack-watcher', 'クリーチャー攻撃時'),
    );
  }

  return candidates;
}
