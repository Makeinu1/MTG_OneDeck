import { useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type { GameScreenInteractionPort } from '../game/gameScreenInteractionPort';
import { GameCard } from '../game/GameCard';
import type { DropIntent } from '../game/dragIntent';
import type { GameState, PlayerId, ZoneId } from '../../engine/types';
import type { CardDef, ManaColor } from '../../types/card';
import { onlineCanonicalDigestFromValueV1, type OnlineParticipantProjectionV1, type OnlineProjectedZoneEntryV1 } from '../../online/projection';
import type { OnlineTabletopIntentEnvelopeV1, OnlineTabletopPrimitiveV1 } from '../../online/tabletopManual';
import './remoteGameScreen.css';

type SubmitTabletopIntent = (intent: OnlineTabletopIntentEnvelopeV1) => void | Promise<void>;
type RemoteCommandSettlementV1 = Readonly<{
  readonly commandId: string;
  readonly baseRevision: number;
  readonly currentRevision: number;
  readonly acceptedRevision: number | null;
  readonly commandKind: 'command' | 'tabletop' | 'visibility' | 'sharedUndo' | 'manualCombatDamage';
  readonly operation: string | null;
  readonly outcome: 'accepted' | 'rejected';
  readonly issueCode: string | null;
}>;

export type RemoteGameScreenPortInput = Readonly<{
  readonly projection: OnlineParticipantProjectionV1 | null;
  readonly interactionState: 'ready' | 'updating' | 'offline';
  readonly busy: boolean;
  readonly onSubmitTabletopIntent: SubmitTabletopIntent;
  readonly lastCommandSettlement?: RemoteCommandSettlementV1 | null;
  readonly recoveryOutcome?: 'rejoined' | null;
  /** Optional server-bound shared undo callback; no snapshot crosses this boundary. */
  readonly onSubmitSharedUndo?: () => void | Promise<void>;
}>;

let commandSequence = 0;
const remoteSessionPrefix = (() => {
  try {
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(8));
      return Array.from(bytes, (byte) => byte.toString(36)).join('').slice(0, 16);
    }
  } catch {
    // Fall through to a process-local entropy source in older browsers.
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
})();

function noOp(): void {}

function phaseOf(phase: OnlineParticipantProjectionV1['game']['turn']['position']['phase']): GameState['phase'] {
  if (phase === 'beginning') return 'upkeep';
  if (phase === 'precombat-main') return 'main1';
  if (phase === 'combat') return 'combat';
  if (phase === 'postcombat-main') return 'main2';
  return 'end';
}

function stepOf(step: string | null): GameState['phase'] {
  if (step === 'untap') return 'untap';
  if (step === 'upkeep') return 'upkeep';
  if (step === 'draw') return 'draw';
  if (step === 'beginning-of-combat' || step === 'declare-attackers' || step === 'declare-blockers' || step === 'combat-damage' || step === 'end-of-combat') return 'combat';
  if (step === 'end') return 'end';
  if (step === 'cleanup') return 'cleanup';
  return 'main1';
}

function cardIdentity(objectId: string): { id: string; zoneChangeCounter: number } {
  const separator = objectId.lastIndexOf(':');
  const suffix = separator >= 0 ? Number(objectId.slice(separator + 1)) : 0;
  return { id: objectId, zoneChangeCounter: Number.isSafeInteger(suffix) && suffix >= 0 ? suffix : 0 };
}

function cardDef(definition: NonNullable<Extract<OnlineProjectedZoneEntryV1, { kind: 'visible-object' }>['definition']>, fallbackId: string): CardDef {
  const source = definition.source.kind === 'scryfall' ? definition.source : null;
  return {
    scryfallId: source?.scryfallId ?? fallbackId,
    oracleId: source?.oracleId ?? fallbackId,
    name: definition.name,
    lang: 'en',
    layout: definition.layout,
    cmc: definition.manaValue,
    colorIdentity: [...definition.colorIdentity],
    typeLine: definition.typeLine,
    keywords: [...definition.keywords],
    producedMana: [...definition.producedMana],
    tokenKind: definition.tokenKind ?? undefined,
    faces: definition.faces.map((face) => ({
      name: face.name,
      manaCost: face.manaCost ?? undefined,
      typeLine: face.typeLine,
      oracleText: face.oracleText,
      power: face.power ?? undefined,
      toughness: face.toughness ?? undefined,
      loyalty: face.loyalty ?? undefined,
      defense: face.defense ?? undefined,
    })),
  };
}

function emptyMana(): GameState['manaPool'] {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

function phaseIsMain(phase: OnlineParticipantProjectionV1['game']['turn']['position']['phase']): boolean {
  return phase === 'precombat-main' || phase === 'postcombat-main';
}

function hasPlayPermission(
  projection: OnlineParticipantProjectionV1,
  actor: PlayerId,
  objectId: string,
  action: 'cast-spell' | 'play-land',
): boolean {
  return projection.game.playPermissions.some((permission) => (
    permission.allowedPlayerId === actor
    && permission.action === action
    && permission.subject.kind === 'object'
    && permission.subject.objectId === objectId
  ));
}

function handDefinition(projection: OnlineParticipantProjectionV1, objectId: string): NonNullable<Extract<OnlineProjectedZoneEntryV1, { kind: 'visible-object' }>['definition']> | null {
  const actor = projection.corePlayerId;
  if (actor === null) return null;
  const entry = projection.game.zones.byPlayer.find((group) => group.playerId === actor)?.zones.hand.entries.find((candidate) => candidate.kind === 'visible-object' && candidate.objectId === objectId);
  return entry?.kind === 'visible-object' ? entry.definition : null;
}

/** Ordinary hand actions stay discoverable without an alternative permission row. */
// eslint-disable-next-line react-refresh/only-export-components
export function remoteHandActionAllowed(
  projection: OnlineParticipantProjectionV1,
  objectId: string,
  action: 'cast-spell' | 'play-land',
): boolean {
  return remoteHandActionEligibility(projection, objectId, action).allowed;
}

export type RemoteHandActionEligibilityV1 = Readonly<{
  readonly allowed: boolean;
  readonly reason:
    | 'allowed'
    | 'card-unavailable'
    | 'hold-active'
    | 'priority-not-held'
    | 'land-limit'
    | 'wrong-window';
  readonly message: string;
}>;

/** Projection-derived affordance only; the server/Core binder is authoritative. */
// eslint-disable-next-line react-refresh/only-export-components
export function remoteHandActionEligibility(
  projection: OnlineParticipantProjectionV1,
  objectId: string,
  action: 'cast-spell' | 'play-land',
): RemoteHandActionEligibilityV1 {
  const actor = projection.corePlayerId;
  const unavailable = (reason: Exclude<RemoteHandActionEligibilityV1['reason'], 'allowed'>, message: string): RemoteHandActionEligibilityV1 => Object.freeze({ allowed: false, reason, message });
  const allowed = (message: string): RemoteHandActionEligibilityV1 => Object.freeze({ allowed: true, reason: 'allowed', message });
  if (actor === null) return unavailable('card-unavailable', 'このカードは現在の投影から操作できません。');
  const priority = projection.game.assistedPriority;
  const anyHold = (priority?.holds?.length ?? 0) > 0 || (projection.game.priorityHolds?.length ?? 0) > 0;
  if (anyHold) return unavailable('hold-active', 'HOLD中のため、解除されるまで操作できません。');
  if (hasPlayPermission(projection, actor, objectId, action)) return allowed('追加の許可があります。最終判定はサーバーで行います。');
  const definition = handDefinition(projection, objectId);
  if (definition === null) return unavailable('card-unavailable', 'このカードは現在の投影から操作できません。');
  const own = projection.game.players.find((player) => player.playerId === actor);
  if (own === undefined) return unavailable('card-unavailable', 'プレイヤー状態を確認できません。');
  const holder = priority === undefined ? projection.game.turn.activePlayerId : priority.holderPlayerId;
  if (holder !== actor) return unavailable('priority-not-held', '現在は相手の優先権です。');
  if (action === 'play-land') {
    const permitted = /\bLand\b/u.test(definition.typeLine)
      && projection.game.turn.activePlayerId === actor
      && (projection.game.turn.position.phase === 'precombat-main' || projection.game.turn.position.phase === 'postcombat-main')
      && projection.game.zones.stack.count === 0
      && own.landsPlayedThisTurn < 1;
    return permitted
      ? allowed('土地を置けます。最終判定はサーバーで行います。')
      : unavailable(own.landsPlayedThisTurn >= 1 ? 'land-limit' : 'wrong-window', own.landsPlayedThisTurn >= 1 ? 'このターンの土地プレイ上限です。' : '土地を置けるメイン・フェイズではありません。');
  }
  const instantOrFlash = /\bInstant\b/u.test(definition.typeLine)
    || definition.keywords.some((keyword) => keyword.toLowerCase() === 'flash');
  if (instantOrFlash) return allowed('応答可能です。支払い・対象・モードは手動確認し、最終判定はサーバーで行います。');
  const permitted = projection.game.zones.stack.count === 0
    && projection.game.turn.activePlayerId === actor
    && phaseIsMain(projection.game.turn.position.phase);
  return permitted
    ? allowed('唱えられます。支払い・対象・モードは手動確認し、最終判定はサーバーで行います。')
    : unavailable('wrong-window', 'この呪文を唱えられるメイン・フェイズではありません。');
}

type RemoteCausalExtras = Readonly<{
  readonly sourceObjectId?: string | null;
  readonly targetObjectIds?: readonly string[];
  readonly targetPlayerIds?: readonly string[];
  readonly recentResolution?: string | null;
  readonly undoAuthorizedPlayerId?: string | null;
}>;

type RemoteCombatFacts = Readonly<{
  readonly step: 'declare-attackers' | 'declare-blockers';
  readonly attackingPlayerId: string;
  readonly attacks: readonly Readonly<{ readonly attackerObjectId: string; readonly defendingPlayerId: string }>[];
  readonly blocks: readonly Readonly<{ readonly blockerObjectId: string; readonly attackedObjectId: string; readonly defendingPlayerId: string }>[];
}>;

type RemoteCommanderDamageFact = Readonly<{
  readonly commanderOwnerPlayerId: string;
  readonly commanderSlot: number;
  readonly defendingPlayerId: string;
  readonly damage: number;
}>;

type RemoteSharedFacts = Readonly<{
  readonly combat: RemoteCombatFacts | null;
  readonly commanderDamage: readonly RemoteCommanderDamageFact[];
  readonly winnerPlayerId: string | null;
  readonly checkpointAvailable: boolean;
  readonly informationExposureWarning: boolean;
}>;

function sharedFacts(projection: OnlineParticipantProjectionV1): RemoteSharedFacts {
  const game = projection.game as unknown as Record<string, unknown>;
  const checkpoint = game.checkpoint as Record<string, unknown> | null | undefined;
  const combatValue = game.combat;
  const combat = combatValue !== null && combatValue !== undefined && typeof combatValue === 'object' && !Array.isArray(combatValue)
    ? (() => {
      const value = combatValue as Record<string, unknown>;
      const attacks = Array.isArray(value.attacks) ? value.attacks.flatMap((entry) => {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const row = entry as Record<string, unknown>;
        return typeof row.attackerObjectId === 'string' && typeof row.defendingPlayerId === 'string'
          ? [{ attackerObjectId: row.attackerObjectId, defendingPlayerId: row.defendingPlayerId }]
          : [];
      }) : [];
      const blocks = Array.isArray(value.blocks) ? value.blocks.flatMap((entry) => {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const row = entry as Record<string, unknown>;
        return typeof row.blockerObjectId === 'string' && typeof row.attackedObjectId === 'string' && typeof row.defendingPlayerId === 'string'
          ? [{ blockerObjectId: row.blockerObjectId, attackedObjectId: row.attackedObjectId, defendingPlayerId: row.defendingPlayerId }]
          : [];
      }) : [];
      const step: RemoteCombatFacts['step'] | null = value.step === 'declare-attackers'
        ? 'declare-attackers'
        : value.step === 'declare-blockers'
          ? 'declare-blockers'
          : null;
      return step !== null && typeof value.attackingPlayerId === 'string'
        ? { step, attackingPlayerId: value.attackingPlayerId, attacks, blocks }
        : null;
    })()
    : null;
  const commanderDamage = Array.isArray(game.commanderDamage) ? game.commanderDamage.flatMap((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    return typeof row.commanderOwnerPlayerId === 'string' && Number.isSafeInteger(row.commanderSlot)
      && typeof row.defendingPlayerId === 'string' && typeof row.damage === 'number'
      ? [{ commanderOwnerPlayerId: row.commanderOwnerPlayerId, commanderSlot: row.commanderSlot as number, defendingPlayerId: row.defendingPlayerId, damage: row.damage }]
      : [];
  }) : [];
  return {
    combat,
    commanderDamage,
    winnerPlayerId: typeof game.winnerPlayerId === 'string' ? game.winnerPlayerId : null,
    checkpointAvailable: checkpoint?.available === true,
    informationExposureWarning: checkpoint?.informationExposureWarning === true,
  };
}

function causalExtras(projection: OnlineParticipantProjectionV1): RemoteCausalExtras {
  const value = projection.game.assistedPriority as unknown as Record<string, unknown> | undefined;
  if (value === undefined || value === null) return {};
  const ids = (candidate: unknown): readonly string[] | undefined => {
    if (!Array.isArray(candidate) || !candidate.every((item): item is string => typeof item === 'string')) return undefined;
    return candidate;
  };
  const recentResolution = value.recentResolution;
  const recentText = typeof recentResolution === 'string'
    ? recentResolution
    : recentResolution !== null && typeof recentResolution === 'object'
      ? (() => {
        const summary = recentResolution as Record<string, unknown>;
        const text = ['summary', 'message', 'label', 'text', 'delta'].map((key) => summary[key]).find((item): item is string => typeof item === 'string');
        if (text !== undefined) return text;
        const destination = summary.destination;
        const destinationLabel = destination === 'battlefield' ? '戦場' : destination === 'owner-graveyard' ? 'オーナーの墓地' : destination === 'cease' ? '消滅' : destination === 'manual' ? '手動処理' : null;
        const revision = typeof summary.acceptedRevision === 'number' ? summary.acceptedRevision : null;
        if (destinationLabel === null && revision === null) return null;
        const objectId = typeof summary.objectId === 'string' ? ` (${summary.objectId})` : '';
        return `解決: ${destinationLabel ?? '状態更新'}${objectId}${revision === null ? '' : ` / 更新 ${revision}`}`;
      })()
      : null;
  return {
    sourceObjectId: typeof value.sourceObjectId === 'string' ? value.sourceObjectId : null,
    targetObjectIds: ids(value.targetObjectIds),
    targetPlayerIds: ids(value.targetPlayerIds),
    recentResolution: recentText,
    undoAuthorizedPlayerId: typeof value.undoAuthorizedPlayerId === 'string' ? value.undoAuthorizedPlayerId : null,
  };
}

function publicEntries(projection: OnlineParticipantProjectionV1): readonly OnlineProjectedZoneEntryV1[] {
  return [
    ...projection.game.zones.battlefield.entries,
    ...projection.game.zones.stack.entries,
    ...projection.game.zones.exile.entries,
    ...projection.game.zones.command.entries,
  ];
}

function automaticFocusPlayer(projection: OnlineParticipantProjectionV1): PlayerId | null {
  const actor = projection.corePlayerId;
  if (actor === null) return null;
  const opponents = new Set<string>(projection.game.players.map((player) => player.playerId).filter((playerId) => playerId !== actor));
  const extras = causalExtras(projection);
  const sourceId = extras.sourceObjectId ?? null;
  const source = sourceId === null ? undefined : publicEntries(projection).find((entry) => entry.kind !== 'hidden-card' && entry.objectId === sourceId);
  const sourceController = source?.kind === 'visible-object'
    ? source.controllerPlayerId
    : source?.kind === 'concealed-object'
      ? (source as OnlineProjectedZoneEntryV1 & Readonly<{ readonly controllerPlayerId?: PlayerId | null }>).controllerPlayerId ?? null
      : null;
  if (sourceController && opponents.has(sourceController)) return sourceController;
  const targets = extras.targetObjectIds ?? [];
  for (const targetId of targets) {
    const target = publicEntries(projection).find((entry) => entry.kind !== 'hidden-card' && entry.objectId === targetId);
    const controller = target?.kind === 'visible-object'
      ? target.controllerPlayerId
      : target?.kind === 'concealed-object'
        ? (target as OnlineProjectedZoneEntryV1 & Readonly<{ readonly controllerPlayerId?: PlayerId | null }>).controllerPlayerId ?? null
        : null;
    if (controller && opponents.has(controller)) return controller;
  }
  for (const targetPlayerId of extras.targetPlayerIds ?? []) {
    if (opponents.has(targetPlayerId)) return targetPlayerId;
  }
  const steward = projection.game.assistedPriority?.stewardPlayerId;
  if (steward && opponents.has(steward)) return steward;
  const active = projection.game.turn.activePlayerId;
  if (opponents.has(active)) return active;
  return projection.game.players.find((player) => opponents.has(player.playerId))?.playerId ?? null;
}

function projectedCard(entry: OnlineProjectedZoneEntryV1, zone: ZoneId, ownerFallback: PlayerId): { cardId: string; card: GameState['cards'][string]; def?: CardDef } | null {
  if (entry.kind === 'hidden-card') return null;
  const identity = cardIdentity(entry.objectId);
  const runtime = entry.runtime;
  const visible = entry.kind === 'visible-object';
  const definition = visible ? entry.definition : null;
  const concealed = entry.kind === 'concealed-object' ? entry as OnlineProjectedZoneEntryV1 & Readonly<{ readonly ownerPlayerId?: PlayerId | null; readonly controllerPlayerId?: PlayerId | null }> : null;
  const owner = visible
    ? entry.ownerPlayerId ?? ownerFallback
    : concealed?.ownerPlayerId ?? ownerFallback;
  const controller = visible
    ? entry.controllerPlayerId ?? owner
    : concealed?.controllerPlayerId ?? owner;
  const defId = definition ? `remote-def:${entry.objectId}` : `remote-concealed:${entry.objectId}`;
  const card = {
    id: identity.id,
    defId,
    zone,
    ownerId: owner,
    controllerId: controller,
    zoneChangeCounter: identity.zoneChangeCounter,
    tapped: runtime?.tapped ?? false,
    faceIndex: runtime?.faceIndex ?? 0,
    faceDown: runtime?.faceDown ?? entry.kind === 'concealed-object',
    counters: Object.fromEntries((runtime?.counters ?? []).map((counter) => [counter.kind, counter.count])),
    damageMarked: runtime?.markedDamage ?? 0,
    hasDeathtouchDamage: false,
    isToken: entry.objectKind === 'token',
    isCommander: visible ? entry.commander : false,
    enteredTurn: 0,
    attachedTo: runtime?.attachment.kind === 'object' ? runtime.attachment.objectId : undefined,
    effectsAuto: false,
  };
  return { cardId: entry.objectId, card, ...(definition ? { def: cardDef(definition, defId) } : {}) };
}

function projectedCombatState(
  projection: OnlineParticipantProjectionV1,
  cards: GameState['cards'],
): NonNullable<GameState['combat']> | null {
  const combat = sharedFacts(projection).combat;
  if (combat === null) return null;
  const attackerIds = new Set(combat.attacks.map((entry) => entry.attackerObjectId));
  const attackers = combat.attacks.flatMap((entry, index) => {
    if (cards[entry.attackerObjectId] === undefined) return [];
    const blockedBy = combat.blocks
      .filter((block) => block.attackedObjectId === entry.attackerObjectId)
      .map((block) => block.blockerObjectId)
      .filter((id) => cards[id] !== undefined);
    return [{
      cardId: entry.attackerObjectId,
      objectId: entry.attackerObjectId,
      controllerId: cards[entry.attackerObjectId]?.controllerId ?? combat.attackingPlayerId,
      target: { type: 'player' as const, playerId: entry.defendingPlayerId },
      blockedBy,
      declaredOrder: index,
    }];
  });
  const blockers = combat.blocks.flatMap((entry, index) => {
    if (cards[entry.blockerObjectId] === undefined || !attackerIds.has(entry.attackedObjectId)) return [];
    return [{
      cardId: entry.blockerObjectId,
      objectId: entry.blockerObjectId,
      controllerId: cards[entry.blockerObjectId]?.controllerId ?? entry.defendingPlayerId,
      blocking: [entry.attackedObjectId],
      declaredOrder: index,
    }];
  });
  const defendingPlayerId = combat.attacks[0]?.defendingPlayerId ?? combat.blocks[0]?.defendingPlayerId ?? projection.game.turn.activePlayerId;
  return {
    combatId: `remote-combat-${projection.revision}`,
    turn: projection.game.turn.turnNumber,
    step: combat.step === 'declare-attackers' ? 'declareAttackers' : 'declareBlockers',
    attackingPlayerId: combat.attackingPlayerId,
    defendingPlayerId,
    attackers,
    blockers,
  };
}

// Shared adapter export is intentionally colocated with the Remote surface.
// eslint-disable-next-line react-refresh/only-export-components
export function projectionToGameState(projection: OnlineParticipantProjectionV1): GameState | null {
  const localPlayerId = projection.corePlayerId;
  if (localPlayerId === null) return null;
  const cards: GameState['cards'] = {};
  const defs: GameState['defs'] = {};
  const zones: GameState['zones'] = { library: [], hand: [], battlefield: [], graveyard: [], exile: [], command: [], stack: [] };
  const zonesByPlayer: GameState['zonesByPlayer'] = {};
  const add = (entry: OnlineProjectedZoneEntryV1, zone: ZoneId, ownerFallback = localPlayerId): void => {
    const result = projectedCard(entry, zone, ownerFallback);
    if (result === null) return;
    cards[result.cardId] = result.card;
    if (result.def) defs[result.card.defId] = result.def;
    zones[zone].push(result.cardId);
  };
  const ownGroup = projection.game.zones.byPlayer.find((group) => group.playerId === localPlayerId);
  const ownPrivate = ownGroup?.zones;
  ownPrivate?.hand.entries.forEach((entry) => add(entry, 'hand'));
  ownPrivate?.graveyard.entries.forEach((entry) => add(entry, 'graveyard'));
  const publicGraveyardIds = new Map<PlayerId, string[]>();
  projection.game.zones.byPlayer.forEach((group) => {
    if (group.playerId === localPlayerId) return;
    const ids: string[] = [];
    group.zones.graveyard.entries.forEach((entry) => {
      const result = projectedCard(entry, 'graveyard', group.playerId);
      if (result === null) return;
      cards[result.cardId] = result.card;
      if (result.def) defs[result.card.defId] = result.def;
      ids.push(result.cardId);
    });
    publicGraveyardIds.set(group.playerId, ids);
  });
  projection.game.zones.battlefield.entries.forEach((entry) => add(entry, 'battlefield'));
  projection.game.zones.stack.entries.forEach((entry) => add(entry, 'stack'));
  projection.game.zones.exile.entries.forEach((entry) => add(entry, 'exile'));
  projection.game.zones.command.entries.forEach((entry) => add(entry, 'command'));
  const combat = projectedCombatState(projection, cards);
  const allPlayers = projection.game.players;
  allPlayers.forEach((player) => {
    const privateZones = projection.game.zones.byPlayer.find((group) => group.playerId === player.playerId)?.zones;
    zonesByPlayer[player.playerId] = {
      library: [],
      hand: player.playerId === localPlayerId ? [...zones.hand] : [],
      graveyard: player.playerId === localPlayerId ? [...zones.graveyard] : [...(publicGraveyardIds.get(player.playerId) ?? [])],
    };
    if (player.playerId !== localPlayerId && privateZones) zonesByPlayer[player.playerId].library = [];
  });
  const players: GameState['players'] = {};
  allPlayers.forEach((player) => {
    players[player.playerId] = {
      id: player.playerId,
      label: player.playerId === localPlayerId ? 'あなた' : `プレイヤー ${player.playerId}`,
      life: player.life,
      poison: player.poison,
      energy: player.energy,
      experience: player.experience,
      manaPool: { ...player.manaPool },
      landsPlayedThisTurn: player.landsPlayedThisTurn,
      spellsCastThisTurn: player.spellsCastThisTurn,
      drawnThisTurn: player.drawnThisTurn,
      mulliganCount: player.mulliganCount,
      maximumHandSizeOverride: player.maximumHandSizeOverride === null ? 'none' : player.maximumHandSizeOverride,
    };
  });
  const commanders = zones.command.flatMap((cardId) => cards[cardId]?.isCommander ? [{ cardId, castCount: 0 }] : []);
  const local = players[localPlayerId];
  const state: GameState = {
    defs,
    cards,
    zones,
    zonesByPlayer,
    commanders,
    effectsAuto: false,
    activePlayerId: projection.game.turn.activePlayerId,
    players,
    turnOrder: [...projection.game.turnOrder],
    localPlayerId,
    turn: projection.game.turn.turnNumber,
    phase: projection.game.turn.position.step === null ? phaseOf(projection.game.turn.position.phase) : stepOf(projection.game.turn.position.step),
    combat,
    life: local?.life ?? 0,
    poison: local?.poison ?? 0,
    energy: local?.energy ?? 0,
    experience: local?.experience ?? 0,
    commanderDamage: {},
    opponentLife: Object.fromEntries(allPlayers.filter((player) => player.playerId !== localPlayerId).map((player) => [player.playerId, player.life])),
    defeat: {},
    emptyLibraryDrawAttemptedSinceLastSba: {},
    manaPool: local ? { ...local.manaPool } : emptyMana(),
    mulliganCount: local?.mulliganCount ?? 0,
    landsPlayedThisTurn: local?.landsPlayedThisTurn ?? 0,
    spellsCastThisTurn: local?.spellsCastThisTurn ?? 0,
    drawnThisTurn: local?.drawnThisTurn ?? 0,
    combatDamagePreventedUntilEndOfTurn: false,
    eventLog: [],
    pendingTriggers: [],
    oncePerTurnTriggerLedger: { turn: projection.game.turn.turnNumber, consumedKeys: [] },
    powerUpActivated: {},
    pendingRuleChoices: [],
    pendingSbaChoices: [],
    linkedExiles: {},
    log: [],
  };
  return state;
}

function nextCommandId(revision?: number): string {
  commandSequence += 1;
  return `remote-surface-${remoteSessionPrefix}-${revision ?? 0}-${commandSequence}`;
}

/** Open a collapsed in-surface panel before following its semantic anchor. */
function openRemotePanel(event: ReactMouseEvent<HTMLAnchorElement>, detailsId: string): void {
  event.preventDefault();
  const target = document.getElementById(detailsId);
  if (!(target instanceof HTMLDetailsElement)) return;
  const surface = target.parentElement;
  for (const panelId of ['online-remote-guided-overlay', 'online-remote-manual-overlay']) {
    const panel = surface?.querySelector<HTMLDetailsElement>(`#${panelId}`) ?? document.getElementById(panelId);
    if (panel instanceof HTMLDetailsElement && panel !== target) panel.open = false;
  }
  target.open = true;
  target.querySelector<HTMLElement>('summary')?.focus();
}

function buildIntent(projection: OnlineParticipantProjectionV1, primitive: OnlineTabletopPrimitiveV1): OnlineTabletopIntentEnvelopeV1 {
  return {
    kind: 'online-tabletop-intent-envelope-v1',
    schemaVersion: 1,
    commandId: nextCommandId(projection.revision),
    baseRevision: projection.revision,
    mode: 'structured',
    primitive,
  };
}

function remoteNoopPort(state: GameState | null): GameScreenInteractionPort {
  return {
    state,
    warnings: [],
    triggerCandidates: [],
    resolutionSession: null,
    guidedDecisionActive: false,
    mulliganDecisionPending: false,
    autoAdvanceToMain: false,
    openCardMenu: noOp,
    handleCardDoubleClick: noOp,
    requestTapForMana: noOp,
    requestActivateAbility: noOp,
    requestDraw: noOp,
    requestShuffleLibrary: noOp,
    requestMulligan: noOp,
    requestKeepHand: noOp,
    requestToggleTap: noOp,
    requestSetAllTapped: noOp,
    requestResolveTop: noOp,
    requestResolveAll: noOp,
    advancePhase: noOp,
    advanceTurn: noOp,
    undo: noOp,
    redo: noOp,
    canUndo: false,
    canRedo: false,
    setManualTargets: noOp,
    confirmGuidedZeroChoice: noOp,
    removeStackItem: noOp,
    completeManualResolution: noOp,
    placePendingTriggersForPriority: noOp,
    putPendingTriggerOnStack: noOp,
    addAbilityToStack: noOp,
    resolveCommanderRitualCue: () => null,
    adjustLife: noOp,
    adjustMana: noOp,
    clearManaPool: noOp,
    adjustPlayerCounter: noOp,
    setMaximumHandSizeOverride: noOp,
    adjustOpponentLife: noOp,
    adjustCommanderDamage: noOp,
    proliferateAll: noOp,
    rollDie: noOp,
    flipCoin: noOp,
    setAutoAdvance: noOp,
    dismissTriggerCandidates: noOp,
    clearWarnings: noOp,
    openLibraryActions: noOp,
    libraryActionsOpen: false,
    openZoneViewer: noOp,
    opponentBoardOpen: false,
    openOpponentBoard: noOp,
    closeOpponentBoard: noOp,
    openTokenDialog: noOp,
    openAttackDialog: noOp,
    openArrangeTop: noOp,
    openCountDialog: noOp,
    requestConfirm: noOp,
    triggerCandidateCount: 0,
    triggerSheetOpen: false,
    processTriggers: noOp,
    closeTriggerSheet: noOp,
    motionArmed: false,
    feedOpen: false,
    openFeed: noOp,
    closeFeed: noOp,
    overlays: null,
    shortcutsBlocked: true,
    transitionCue: null,
    dismissTransitionCue: noOp,
    performDrop: noOp,
    closeTransientUi: noOp,
  };
}

// The hook and its surface component share one private adapter implementation.
// eslint-disable-next-line react-refresh/only-export-components
export function useRemoteGameScreenInteractionPort(input: RemoteGameScreenPortInput): GameScreenInteractionPort {
  return useMemo(() => {
    const state = input.projection === null ? null : projectionToGameState(input.projection);
    if (input.projection === null || state === null) return remoteNoopPort(state);
    const projection = input.projection;
    const submit = (primitive: OnlineTabletopPrimitiveV1): void => {
      if (input.interactionState !== 'ready' || input.busy) return;
      void input.onSubmitTabletopIntent(buildIntent(projection, primitive));
    };
    const localCardObjectId = (cardId: string): string | null => state.cards[cardId]?.id ?? null;
    const port = remoteNoopPort(state);
    const actor = projection.corePlayerId;
    if (actor === null) return port;
    port.libraryCount = projection.game.zones.byPlayer.find((group) => group.playerId === actor)?.zones.library.count ?? 0;
    port.requestDraw = (count) => submit({ kind: 'draw', count });
    port.requestShuffleLibrary = () => submit({ kind: 'shuffle' });
    port.requestToggleTap = (cardId) => {
      const card = state.cards[cardId];
      const objectId = localCardObjectId(cardId);
      if (!card || card.controllerId !== actor || objectId === null) return;
      submit({ kind: 'tap', objectId: objectId as never, tapped: !card.tapped });
    };
    // Bulk actions are intentionally unsupported on the remote surface: the
    // wire contract has no aggregate primitive, and looping would reuse one
    // projection revision for multiple commands.
    port.requestToggleTapMany = () => false;
    port.requestSetAllTapped = noOp;
    const priority = projection.game.assistedPriority;
    const anyHold = (priority?.holds?.length ?? 0) > 0 || (projection.game.priorityHolds?.length ?? 0) > 0;
    const steward = priority?.stewardPlayerId ?? (projection.game.zones.stack.count === 0 ? projection.game.turn.activePlayerId : null);
    const holder = priority === undefined ? projection.game.turn.activePlayerId : priority.holderPlayerId;
    const canPass = holder === actor && !anyHold;
    const windowKind = priority?.windowKind ?? '';
    const canAdvance = !anyHold && steward === actor && (priority === undefined || ['turn-based-action-required', 'position-advance-ready', 'turn-advance-ready', 'cleanup-repeat-ready'].includes(windowKind));
    // The server resolves only the actual stack top. Keep one projected top
    // identity for every resolve affordance so a lower StackBand item cannot
    // accidentally resolve whatever happens to be on top remotely.
    const projectedTopEntry = projection.game.zones.stack.entries.at(-1);
    const projectedTopObjectId = projectedTopEntry !== undefined && projectedTopEntry.kind !== 'hidden-card'
      ? projectedTopEntry.objectId
      : null;
    const canResolve = !anyHold
      && steward === actor
      && windowKind === 'resolution-ready'
      && projectedTopObjectId !== null
      && priority?.topStackObjectId === projectedTopObjectId;
    const extras = causalExtras(projection);
    const facts = sharedFacts(projection);
    const undoAuthorized = extras.undoAuthorizedPlayerId === actor;
    const canUndo = input.onSubmitSharedUndo !== undefined
      && input.interactionState === 'ready'
      && !input.busy
      && !anyHold
      && facts.checkpointAvailable
      && undoAuthorized;
    port.canUndo = canUndo;
    port.undo = () => {
      if (canUndo) void input.onSubmitSharedUndo?.();
    };
    port.requestResolveTop = () => { if (canResolve) submit({ kind: 'priority-resolve' }); };
    port.requestResolveAll = () => { if (canResolve) submit({ kind: 'priority-resolve' }); };
    port.advancePhase = () => {
      if (canAdvance) submit({ kind: 'priority-advance' });
      else if (canPass) submit({ kind: 'priority-pass' });
    };
    port.advanceTurn = port.advancePhase;
    port.performDrop = (intent: DropIntent) => {
      if (intent.kind === 'cast') {
        const objectId = localCardObjectId(intent.cardId);
        const permitted = objectId !== null && remoteHandActionAllowed(projection, objectId, 'cast-spell');
        if (permitted) submit({ kind: 'cast-spell', objectId: objectId as never });
      } else if (intent.kind === 'play-land') {
        const objectId = localCardObjectId(intent.cardId);
        const permitted = objectId !== null && remoteHandActionAllowed(projection, objectId, 'play-land');
        if (permitted) submit({ kind: 'play-land', objectId: objectId as never });
      } else if (intent.kind === 'move-zone') {
        const objectId = localCardObjectId(intent.cardId);
        if (objectId && intent.zone !== 'library') submit({ kind: 'move', objectId: objectId as never, destination: { kind: intent.zone === 'hand' ? 'owner-hand' : intent.zone === 'graveyard' ? 'owner-graveyard' : intent.zone === 'battlefield' ? 'battlefield' : 'exile', ...(intent.zone === 'battlefield' ? { baseControllerPlayerId: actor } : {}) } as never });
      }
    };
    port.removeStackItem = (id) => {
      if (!canResolve || id !== projectedTopObjectId) return;
      submit({ kind: 'priority-resolve' });
    };
    port.adjustLife = (delta) => submit({ kind: 'life', field: 'life', delta });
    port.adjustMana = (color: ManaColor, delta: number) => submit({ kind: 'mana', color, delta });
    port.clearManaPool = noOp;
    port.openCardMenu = noOp;
    port.handleCardDoubleClick = (cardId) => {
      const card = state.cards[cardId];
      if (!card) return;
      if (card.zone === 'hand') port.performDrop({ kind: cardId && state.defs[card.defId]?.typeLine.includes('Land') ? 'play-land' : 'cast', cardId });
      else if (card.zone === 'battlefield') port.requestToggleTap(cardId);
    };
    port.overlays = null;
    return port;
  }, [input]);
}

export function RemoteGameScreenActionRail({
  projection,
  interactionState,
  busy,
  onSubmitTabletopIntent,
  lastCommandSettlement,
  recoveryOutcome,
  port,
}: RemoteGameScreenPortInput & Readonly<{ readonly port: GameScreenInteractionPort }>): ReactNode {
  const [focusedPlayerId, setFocusedPlayerId] = useState<string | null>(null);
  if (projection === null || port.state === null) return null;
  const local = projection.corePlayerId;
  if (local === null) return null;
  const ownGroup = projection.game.zones.byPlayer.find((group) => group.playerId === local);
  const ownHand = ownGroup?.zones.hand.entries ?? [];
  const ownHandActions = ownHand.flatMap((entry) => {
    if (entry.kind !== 'visible-object' || entry.definition === null) return [];
    const cardId = entry.objectId;
    const isLand = /\bLand\b/u.test(entry.definition.typeLine);
    const action = isLand ? 'play-land' as const : 'cast' as const;
    const eligibility = remoteHandActionEligibility(projection, cardId, action === 'play-land' ? 'play-land' : 'cast-spell');
    return [{ cardId, label: entry.definition.name, action, eligibility }];
  });
  const stackTop = projection.game.zones.stack.entries.at(-1);
  const extras = causalExtras(projection);
  const facts = sharedFacts(projection);
  const automaticFocus = automaticFocusPlayer(projection);
  const effectiveFocus = focusedPlayerId ?? automaticFocus;
  const priority = projection.game.assistedPriority;
  const ownHeld = priority?.holds?.includes(local) ?? projection.game.priorityHolds?.some((hold) => hold.playerId === local) ?? false;
  const anyHold = (priority?.holds?.length ?? 0) > 0 || (projection.game.priorityHolds?.length ?? 0) > 0;
  const disabled = interactionState !== 'ready' || busy;
  const steward = priority?.stewardPlayerId ?? (projection.game.zones.stack.count === 0 ? projection.game.turn.activePlayerId : null);
  const holder = priority === undefined ? projection.game.turn.activePlayerId : priority.holderPlayerId;
  const canPass = holder === local && !anyHold;
  const canAdvance = !anyHold && steward === local && (priority === undefined || ['turn-based-action-required', 'position-advance-ready', 'turn-advance-ready', 'cleanup-repeat-ready'].includes(priority.windowKind));
  const canReportSba = !anyHold && steward === local && priority?.windowKind === 'sba-check-required';
  const stackTopObjectId = stackTop !== undefined && stackTop.kind !== 'hidden-card' ? stackTop.objectId : null;
  const canResolve = !anyHold && steward === local && priority?.windowKind === 'resolution-ready' && priority.topStackObjectId === stackTopObjectId;
  const castSettlement = lastCommandSettlement?.commandKind === 'tabletop' && lastCommandSettlement.operation === 'cast-spell'
    ? lastCommandSettlement
    : null;
  const sbaSettlement = lastCommandSettlement?.commandKind === 'tabletop' && lastCommandSettlement.operation === 'sba-check-outcome'
    ? lastCommandSettlement
    : null;
  const prioritySettlement = lastCommandSettlement?.commandKind === 'tabletop'
    && (lastCommandSettlement.operation === 'priority-hold'
      || lastCommandSettlement.operation === 'priority-pass'
      || lastCommandSettlement.operation === 'priority-resolve')
    ? lastCommandSettlement
    : null;
  const prioritySettlementLabel = prioritySettlement?.operation === 'priority-hold'
    ? 'HOLD操作'
    : prioritySettlement?.operation === 'priority-pass'
      ? '優先権のパス'
      : 'スタックの解決';
  const latestNote = projection.game.notes?.at(-1);
  const opponentSeats = projection.game.players
    .filter((player) => player.playerId !== local)
    .map((player) => ({
      player,
      handCount: projection.game.zones.byPlayer.find((group) => group.playerId === player.playerId)?.zones.hand.count ?? 0,
      graveyardCount: projection.game.zones.byPlayer.find((group) => group.playerId === player.playerId)?.zones.graveyard.count ?? 0,
      battlefieldCount: projection.game.zones.battlefield.entries.filter((entry) => {
        if (entry.kind === 'hidden-card') return false;
        const controller = entry.kind === 'visible-object'
          ? entry.controllerPlayerId
          : (entry as OnlineProjectedZoneEntryV1 & Readonly<{ readonly controllerPlayerId?: PlayerId | null }>).controllerPlayerId ?? null;
        return controller === player.playerId;
      }).length,
    }));
  const opponentLanes = projection.game.zones.battlefield.entries.flatMap((entry) => {
    if (entry.kind === 'hidden-card') return [];
    const controller = entry.kind === 'visible-object'
      ? entry.controllerPlayerId
      : (entry as OnlineProjectedZoneEntryV1 & Readonly<{ readonly controllerPlayerId?: PlayerId | null }>).controllerPlayerId ?? null;
    return controller && controller !== local ? [{ controller, entry }] : [];
  });
  const sourceId = extras.sourceObjectId;
  const sourceEntry = sourceId === undefined || sourceId === null
    ? undefined
    : publicEntries(projection).find((entry) => entry.kind !== 'hidden-card' && entry.objectId === sourceId);
  const sourceLabel = sourceEntry?.kind === 'visible-object'
    ? `《${sourceEntry.definition?.name ?? '公開オブジェクト'}》`
    : sourceEntry?.kind === 'concealed-object'
      ? '裏向きの公開オブジェクト'
      : null;
  const targetIds = extras.targetObjectIds ?? [];
  const targetLabels = targetIds.slice(0, 3).map((targetId) => {
    const target = publicEntries(projection).find((entry) => entry.kind !== 'hidden-card' && entry.objectId === targetId);
    return target?.kind === 'visible-object' ? `《${target.definition?.name ?? '公開オブジェクト'}》` : target ? '裏向きの公開オブジェクト' : '対象';
  });
  const targetPlayerIds = extras.targetPlayerIds ?? [];
  const targetPlayerLabels = targetPlayerIds.slice(0, 3).map((playerId) => `プレイヤー ${playerId}`);
  const postResolutionDelta = extras.recentResolution?.slice(0, 160) ?? null;
  const undoAuthorized = extras.undoAuthorizedPlayerId === local;
  const seatOutcomes = projection.room.seats.map((seat) => ({ playerId: seat.corePlayerId, outcome: seat.outcome }));
  const disconnectedPlayerIds = projection.room.participants.flatMap((participant) => {
    if (participant.role !== 'player' || participant.presence !== 'disconnected' || participant.seatIndex === null) return [];
    const seat = projection.room.seats[participant.seatIndex];
    return seat === undefined ? [] : [seat.corePlayerId];
  });
  const outcomeLabel = (outcome: string): string => outcome === 'conceded' ? '投了' : outcome === 'defeated' ? '敗北' : '進行中';
  const connectionLabel = interactionState === 'ready' ? '接続済み' : interactionState === 'updating' ? '再同期中' : 'オフライン';
  const phaseLabel = projection.game.turn.position.phase === 'precombat-main'
    ? 'メイン1'
    : projection.game.turn.position.phase === 'postcombat-main'
      ? 'メイン2'
      : projection.game.turn.position.phase === 'beginning'
        ? '開始フェイズ'
        : projection.game.turn.position.phase === 'combat'
          ? '戦闘'
          : '終了フェイズ';
  const priorityLabel = priority?.holderPlayerId === local
    ? 'あなた'
    : priority?.holderPlayerId ?? '—';
  const holdLabel = anyHold
    ? ownHeld ? 'あなたがHOLD中' : '他プレイヤーがHOLD中'
    : 'HOLDなし';
  const publicSeatIds = projection.room.seats.map((seat) => seat.corePlayerId).join(',');
  const sharedPublicDigest = onlineCanonicalDigestFromValueV1({
    kind: 'remote-shared-public-projection-v1',
    revision: projection.revision,
    room: {
      lifecycle: projection.room.lifecycle,
      participants: projection.room.participants.flatMap((participant) => {
        if (participant.role !== 'player' || participant.seatIndex === null) return [];
        const seat = projection.room.seats[participant.seatIndex];
        return seat === undefined ? [] : [{ playerId: seat.corePlayerId, presence: participant.presence }];
      }),
      seats: projection.room.seats.map((seat) => ({ playerId: seat.corePlayerId, outcome: seat.outcome })),
    },
    game: {
      turn: projection.game.turn,
      players: projection.game.players,
      zones: {
        byPlayer: projection.game.zones.byPlayer.map((group) => ({
          playerId: group.playerId,
          libraryCount: group.zones.library.count,
          handCount: group.zones.hand.count,
          graveyard: group.zones.graveyard,
        })),
        battlefield: projection.game.zones.battlefield,
        stack: projection.game.zones.stack,
        exile: projection.game.zones.exile,
        command: projection.game.zones.command,
      },
      assistedPriority: projection.game.assistedPriority ?? null,
      priorityHolds: projection.game.priorityHolds ?? [],
      notes: projection.game.notes ?? [],
    },
  });
  const priorityHolds = priority?.holds ?? projection.game.priorityHolds?.map((hold) => hold.playerId) ?? [];
  const recentResolution = (projection.game.assistedPriority as unknown as Readonly<{
    readonly recentResolution?: Readonly<{ readonly objectId: string | null; readonly acceptedRevision: number }> | null;
  }> | undefined)?.recentResolution ?? null;
  return (
    <section
      className="online-remote-rail"
      data-testid="online-remote-game-rail"
      aria-label="共有ゲーム操作"
      data-projection-revision={projection.revision}
      data-public-seat-ids={publicSeatIds}
      data-local-player-id={local}
      data-shared-public-digest={sharedPublicDigest}
      data-priority-holder-player-id={priority?.holderPlayerId ?? ''}
      data-priority-steward-player-id={priority?.stewardPlayerId ?? ''}
      data-priority-window-kind={priority?.windowKind ?? ''}
      data-priority-holds={priorityHolds.join(',')}
      data-recent-resolution-object-id={recentResolution?.objectId ?? ''}
      data-recent-resolution-revision={recentResolution === null ? '' : String(recentResolution.acceptedRevision)}
    >
      <header className="online-remote-rail__header">
        <h2 id="online-remote-rail-title">共有テーブル</h2>
        <span
          data-testid="online-remote-connection"
          data-recovery-outcome={recoveryOutcome ?? ''}
          role="status"
          aria-live="polite"
        >
          {recoveryOutcome === 'rejoined' && '再接続しました / '}{connectionLabel} / 更新 {projection.revision}
        </span>
      </header>
      <div className="online-remote-rail__state" data-testid="online-remote-state" aria-live="polite">
        <span>手番: {projection.game.turn.activePlayerId} / {phaseLabel}</span>
        <span>優先権: {priorityLabel}</span>
        <span data-testid="online-remote-hold-status">{holdLabel}</span>
        {priority?.stewardPlayerId && <span>steward: {priority.stewardPlayerId}</span>}
        <span
          data-testid="online-remote-presence"
          data-disconnected-player-ids={disconnectedPlayerIds.join(',')}
        >
          {disconnectedPlayerIds.length === 0 ? '全席接続中' : `切断中: ${disconnectedPlayerIds.join(' / ')}`}
        </span>
      </div>
      <div className="online-remote-rail__causal" data-testid="online-remote-causal" data-stack-count={projection.game.zones.stack.count} data-stack-top-object-id={stackTopObjectId ?? ''}>
        <span>スタック {projection.game.zones.stack.count}件</span>
        {sourceLabel && <span>発生源: {sourceLabel}</span>}
        {(targetLabels.length > 0 || targetPlayerLabels.length > 0) && <span>対象: {[...targetLabels, ...targetPlayerLabels].join(' / ')}{targetIds.length + targetPlayerIds.length > 3 ? ` 他${targetIds.length + targetPlayerIds.length - 3}件` : ''}</span>}
        {priority?.stewardPlayerId && <span>解決担当: {priority.stewardPlayerId}</span>}
        {priority?.responseWindow && <span>応答窓: {priority.responseWindow}</span>}
        {postResolutionDelta && <span data-testid="online-remote-post-resolution">直近の変化: {postResolutionDelta}</span>}
        {latestNote && <span>直近: {latestNote.text}</span>}
      </div>
      {castSettlement !== null && (
        <p
          className="online-remote-rail__command-result"
          data-testid="online-remote-command-result"
          data-command-id={castSettlement.commandId}
          data-operation="cast-spell"
          data-outcome={castSettlement.outcome}
          data-base-revision={castSettlement.baseRevision}
          data-current-revision={castSettlement.currentRevision}
          data-accepted-revision={castSettlement.acceptedRevision ?? ''}
          role="status"
          aria-live="polite"
        >
          {castSettlement.outcome === 'accepted'
            ? `唱える操作を受理しました（更新 ${String(castSettlement.acceptedRevision)}）。`
            : '唱える操作は拒否されました。盤面を更新せず、現在の表示を確認してください。'}
        </p>
      )}
      {priority?.windowKind === 'sba-check-required' && (
        <p className="online-remote-rail__sba-guidance" data-testid="online-remote-sba-guidance">
          状況起因処理（SBA）は自動判定しません。卓で共有状態へ反映した結果を、現在の優先権受領者が明示してください。
        </p>
      )}
      {sbaSettlement !== null && (
        <p
          className="online-remote-rail__command-result"
          data-testid="online-remote-sba-result"
          data-command-id={sbaSettlement.commandId}
          data-outcome={sbaSettlement.outcome}
          data-current-revision={sbaSettlement.currentRevision}
          data-accepted-revision={sbaSettlement.acceptedRevision ?? ''}
          role="status"
          aria-live="polite"
        >
          {sbaSettlement.outcome === 'accepted'
            ? 'SBA確認結果を共有テーブルへ記録しました。'
            : 'SBA確認結果は拒否されました。共有状態は変更されていません。'}
        </p>
      )}
      {prioritySettlement !== null && (
        <p
          className="online-remote-rail__command-result"
          data-testid="online-remote-priority-result"
          data-command-id={prioritySettlement.commandId}
          data-operation={prioritySettlement.operation ?? ''}
          data-outcome={prioritySettlement.outcome}
          data-base-revision={prioritySettlement.baseRevision}
          data-current-revision={prioritySettlement.currentRevision}
          data-accepted-revision={prioritySettlement.acceptedRevision ?? ''}
          role="status"
          aria-live="polite"
        >
          {prioritySettlement.outcome === 'accepted'
            ? `${prioritySettlementLabel}を共有しました（更新 ${String(prioritySettlement.acceptedRevision)}）。`
            : `${prioritySettlementLabel}は拒否されました。共有状態は変更されていません。`}
        </p>
      )}
      {facts.combat && (
        <section className="online-remote-rail__combat" data-testid="online-remote-combat" aria-label="共有戦闘">
          <strong>戦闘 {facts.combat.step === 'declare-attackers' ? '攻撃指定' : 'ブロック指定'}</strong>
          <span>攻撃 {facts.combat.attacks.length}件 / ブロック {facts.combat.blocks.length}件</span>
          <span>攻撃プレイヤー: {facts.combat.attackingPlayerId}</span>
          <span className="online-remote-rail__manual">割当・ダメージは Manual Damage で確認</span>
        </section>
      )}
      {facts.commanderDamage.length > 0 && (
        <section className="online-remote-rail__commander-damage" data-testid="online-remote-commander-damage" aria-label="統率者ダメージ">
          <strong>統率者ダメージ</strong>
          {facts.commanderDamage.map((entry) => (
            <span key={`${entry.commanderOwnerPlayerId}:${entry.commanderSlot}:${entry.defendingPlayerId}`}>
              {entry.commanderOwnerPlayerId} #{entry.commanderSlot + 1} → {entry.defendingPlayerId}: {entry.damage}
            </span>
          ))}
        </section>
      )}
      {(facts.winnerPlayerId !== null || seatOutcomes.some((seat) => seat.outcome !== 'pending')) && (
        <section className="online-remote-rail__outcome" data-testid="online-remote-outcome" aria-label="ゲーム結果">
          {facts.winnerPlayerId !== null && <strong>勝者: {facts.winnerPlayerId}</strong>}
          {seatOutcomes.map((seat) => <span key={seat.playerId}>{seat.playerId}: {outcomeLabel(seat.outcome)}</span>)}
        </section>
      )}
      {facts.checkpointAvailable && facts.informationExposureWarning && (
        <p className="online-remote-rail__exposure-warning" data-testid="online-remote-exposure-warning">公開情報は記憶から消せないため、UNDO後も忘れられません。</p>
      )}
      {facts.checkpointAvailable && !facts.informationExposureWarning && (
        <p className="online-remote-rail__checkpoint" data-testid="online-remote-checkpoint">共有チェックポイント: 利用可能（stewardのみ）</p>
      )}
      <div className="online-remote-rail__seats" aria-label="対戦相手の公開情報">
        {opponentSeats.map(({ player, handCount, graveyardCount, battlefieldCount }) => (
          <button key={player.playerId} type="button" className="online-remote-rail__seat" data-testid="online-remote-opponent" aria-pressed={effectiveFocus === player.playerId} onClick={() => setFocusedPlayerId((current) => current === player.playerId ? null : player.playerId)}>
            {player.playerId} ♥{player.life} / 手札 {handCount} / 墓地 {graveyardCount} / 戦場 {battlefieldCount}
          </button>
        ))}
      </div>
      <div className="online-remote-rail__opponent-lanes" data-opponent-count={opponentSeats.length} aria-label="対戦相手の公開パーマネント">
        {opponentSeats.map(({ player }) => {
          const cards = opponentLanes.filter(({ controller }) => controller === player.playerId);
          return (
            <section key={player.playerId} className="online-remote-rail__opponent-lane" data-focused={effectiveFocus === player.playerId || undefined}>
              <header><strong>{player.playerId}</strong><span>{effectiveFocus === player.playerId ? 'フォーカス中' : '公開盤面'}</span></header>
              <div className="online-remote-rail__opponent-cards">
                {cards.length === 0 && <span className="online-remote-rail__empty">公開パーマネントなし</span>}
                {cards.map(({ entry }) => <GameCard key={entry.objectId} controller={port} cardId={entry.objectId} size="board" draggable={false} />)}
              </div>
            </section>
          );
        })}
      </div>
      <div className="online-remote-rail__actions">
        {ownHandActions.slice(0, 8).map((entry) => {
          const descriptionId = `online-remote-${entry.action}-${entry.cardId.replaceAll(/[^A-Za-z0-9_-]/gu, '-')}-availability`;
          return (
            <span className="online-remote-rail__card-action" key={entry.cardId}>
              <button
                type="button"
                data-testid={entry.eligibility.allowed ? `online-remote-${entry.action}` : `online-remote-${entry.action}-unavailable`}
                data-object-id={entry.cardId}
                disabled={disabled || !entry.eligibility.allowed}
                aria-describedby={descriptionId}
                onClick={() => port.performDrop({ kind: entry.action, cardId: entry.cardId })}
              >
                {entry.action === 'play-land' ? '土地' : '唱える'} 《{entry.label}》
              </button>
              <small id={descriptionId} data-testid={`online-remote-${entry.action}-availability`} data-availability={entry.eligibility.reason}>{entry.eligibility.message}</small>
            </span>
          );
        })}
        <button type="button" className="online-remote-rail__secondary-action" data-testid="online-remote-hold" aria-pressed={ownHeld} disabled={disabled} onClick={() => {
          const intent = { kind: 'online-tabletop-intent-envelope-v1' as const, schemaVersion: 1 as const, commandId: nextCommandId(projection.revision), baseRevision: projection.revision, mode: 'structured' as const, primitive: { kind: 'priority-hold' as const, held: !ownHeld } };
          void onSubmitTabletopIntent(intent);
        }}>{ownHeld ? 'HOLD解除' : 'HOLD'}</button>
        <button type="button" className="online-remote-rail__secondary-action" data-testid="online-remote-pass" disabled={disabled || !canPass} onClick={() => {
          void onSubmitTabletopIntent(buildIntent(projection, { kind: 'priority-pass' }));
        }}>優先権をパス</button>
        <button type="button" className="online-remote-rail__primary-action" data-testid="online-remote-sba-stable" disabled={disabled || !canReportSba} onClick={() => {
          void onSubmitTabletopIntent(buildIntent(projection, { kind: 'sba-check-outcome', actionsWereApplied: false }));
        }}>適用すべきSBAなし（卓で確認）</button>
        <button type="button" className="online-remote-rail__secondary-action" data-testid="online-remote-sba-applied" disabled={disabled || !canReportSba} onClick={() => {
          void onSubmitTabletopIntent(buildIntent(projection, { kind: 'sba-check-outcome', actionsWereApplied: true }));
        }}>SBAを共有状態へ適用済み（再確認）</button>
        <button type="button" className="online-remote-rail__primary-action" data-testid="online-remote-advance" disabled={disabled || anyHold || (!canAdvance && !canPass)} onClick={() => port.advancePhase()}>次の判断へ</button>
        <button type="button" className="online-remote-rail__primary-action" data-testid="online-remote-resolve" disabled={disabled || !canResolve} onClick={() => port.requestResolveTop()}>スタックを解決</button>
        <button type="button" className="online-remote-rail__secondary-action" data-testid="online-remote-undo" data-undo-authorized={undoAuthorized || undefined} disabled={!port.canUndo} onClick={() => port.undo()} aria-label={port.canUndo ? '共有チェックポイントへ1手戻す' : undoAuthorized ? 'UNDO unavailable (checkpoint unavailable or HOLD active)' : 'UNDO unavailable (steward only)'}>{port.canUndo ? 'UNDO（1手戻す）' : 'UNDO unavailable (checkpoint/steward)'}</button>
      </div>
      <section className="online-remote-rail__manual-fallback" data-testid="online-remote-manual-fallback" aria-labelledby="online-remote-manual-fallback-title">
        <strong id="online-remote-manual-fallback-title">未対応の複合効果 → Manual Resolve</strong>
        <span>自動解決せず、公開事実を確認してから手動で記録します。</span>
        <nav aria-label="ガイドと手動操作">
          <a className="online-remote-rail__manual-link" data-testid="online-remote-manual-damage-link" href="#online-remote-guided-overlay" onClick={(event) => openRemotePanel(event, 'online-remote-guided-overlay')}>戦闘 / Manual Damage</a>
          <a className="online-remote-rail__manual-link" href="#online-remote-manual-overlay" onClick={(event) => openRemotePanel(event, 'online-remote-manual-overlay')}>Structured / Freeform Manual Resolve</a>
          <a className="online-remote-rail__manual-link" href="#online-remote-manual-overlay" onClick={(event) => openRemotePanel(event, 'online-remote-manual-overlay')}>Visibility / Choose</a>
        </nav>
      </section>
    </section>
  );
}
