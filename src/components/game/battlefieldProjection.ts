import type { CardInstance, GameState } from '../../engine/types';

export type BattlefieldRole = 'creature' | 'land' | 'support';

export interface VisualTokenBundle {
  key: string;
  representativeId: string;
  cardIds: string[];
}

export interface AttachmentCluster {
  hostId: string;
  cardIds: string[];
}

export interface BattlefieldBuckets {
  creatures: VisualTokenBundle[];
  lands: string[];
  support: VisualTokenBundle[];
  attachmentsByHost: ReadonlyMap<string, AttachmentCluster>;
  orphanAttachments: string[];
}

export function currentTypeLine(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  const def = card ? state.defs[card.defId] : undefined;
  const face = card ? def?.faces[card.faceIndex] ?? def?.faces[0] : undefined;
  return face?.typeLine ?? def?.typeLine ?? '';
}

export function battlefieldRole(state: GameState, cardId: string): BattlefieldRole {
  const typeLine = currentTypeLine(state, cardId);
  // A planeswalker is intentionally presented with the other nonland
  // permanents. Giving it a private dock steals space and makes the same kind
  // of battlefield object use a different interaction model.
  if (/\bPlaneswalker\b/i.test(typeLine)) return 'support';
  if (/\bCreature\b/i.test(typeLine)) return 'creature';
  if (/\bLand\b/i.test(typeLine)) return 'land';
  return 'support';
}

function stableRecord(record: Readonly<Record<string, number>>): string {
  return Object.entries(record)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join(',');
}

function tokenVisualKey(state: GameState, card: CardInstance): string {
  const attacker = state.combat?.attackers.find((entry) => entry.cardId === card.id);
  const blocker = state.combat?.blockers.find((entry) => entry.cardId === card.id);
  return [
    card.defId,
    card.faceIndex,
    card.controllerId,
    card.tapped ? 1 : 0,
    stableRecord(card.counters),
    card.damageMarked,
    card.hasDeathtouchDamage ? 1 : 0,
    card.enteredTurn,
    [...(card.manualKeywords ?? [])].sort().join(','),
    card.attachedTo ?? '',
    card.faceDown ? 1 : 0,
    card.isCopy ? 1 : 0,
    card.isScenarioDummy ? 1 : 0,
    attacker ? `attacking:${attacker.target.playerId}:${attacker.declaredOrder}` : '',
    blocker ? `blocking:${blocker.blocking.join(',')}:${blocker.declaredOrder}` : '',
  ].join('|');
}

export function bundleVisibleTokens(state: GameState, cardIds: readonly string[]): VisualTokenBundle[] {
  const result: VisualTokenBundle[] = [];
  const tokenByKey = new Map<string, VisualTokenBundle>();
  for (const cardId of cardIds) {
    const card = state.cards[cardId];
    if (!card?.isToken || card.isCommander) {
      result.push({ key: `card:${cardId}`, representativeId: cardId, cardIds: [cardId] });
      continue;
    }
    const key = `token:${tokenVisualKey(state, card)}`;
    const existing = tokenByKey.get(key);
    if (existing) {
      existing.cardIds.push(cardId);
      continue;
    }
    const bundle = { key, representativeId: cardId, cardIds: [cardId] };
    tokenByKey.set(key, bundle);
    result.push(bundle);
  }
  return result;
}

export function projectBattlefield(state: GameState, playerId = state.localPlayerId): BattlefieldBuckets {
  const visible: string[] = [];
  const attached: string[] = [];
  for (const cardId of state.zones.battlefield) {
    const card = state.cards[cardId];
    if (!card || card.controllerId !== playerId || card.isAbility) continue;
    if (card.attachedTo) attached.push(cardId);
    else visible.push(cardId);
  }

  const attachmentsByHost = new Map<string, AttachmentCluster>();
  const orphanAttachments: string[] = [];
  for (const cardId of attached) {
    const hostId = state.cards[cardId]?.attachedTo;
    const host = hostId ? state.cards[hostId] : undefined;
    if (!hostId || !host || host.zone !== 'battlefield' || host.controllerId !== playerId) {
      orphanAttachments.push(cardId);
      continue;
    }
    const cluster = attachmentsByHost.get(hostId) ?? { hostId, cardIds: [] };
    cluster.cardIds.push(cardId);
    attachmentsByHost.set(hostId, cluster);
  }

  const creatures: string[] = [];
  const lands: string[] = [];
  const support: string[] = [...orphanAttachments];
  for (const cardId of visible) {
    switch (battlefieldRole(state, cardId)) {
      case 'creature': creatures.push(cardId); break;
      case 'land': lands.push(cardId); break;
      case 'support': support.push(cardId); break;
    }
  }

  return {
    creatures: bundleVisibleTokens(state, creatures),
    lands,
    support: bundleVisibleTokens(state, support),
    attachmentsByHost,
    orphanAttachments,
  };
}
