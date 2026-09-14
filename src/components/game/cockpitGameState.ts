import type { CockpitTable } from '../../engine/cockpitTable';
import { cockpitPowerToughness, type RecordedPowerToughness } from '../../engine/cockpitPowerToughness';
import {
  objectIdOf,
  type CardInstance,
  type GameState,
  type CombatState,
  type ObjectSnapshot,
  type TargetSelection,
} from '../../engine/types';

/** Read-only presentation for the existing card, hand, land and stack components.
 * Commands still go through CockpitSessionScreen.send; this view is never restored
 * into the local store or passed to applyCommand.
 */
export function cockpitGameState(table: CockpitTable, ownId: string): GameState {
  const own = table.seats.find((seat) => seat.id === ownId)!;
  const cards: Record<string, CardInstance & {
    displayPowerToughness?: RecordedPowerToughness;
    displayModifierKey?: string;
  }> = Object.fromEntries(
    Object.entries(table.cards).map(([id, card]) => [
      id,
      {
        ...card,
        // Presentation-only discriminator: do not bundle tokens with different recorded modifiers.
        displayPowerToughness: cockpitPowerToughness(table, id),
        displayModifierKey: JSON.stringify(table.modifiers.filter((modifier) => modifier.cardId === id)
          .map((modifier) => [modifier.id, modifier.power, modifier.toughness, modifier.duration])),
        effectsAuto: false,
        manualKeywords: [
          ...new Set([
            ...(card.manualKeywords ?? []),
            ...table.grants.filter((grant) => grant.cardId === id).map((grant) => grant.keyword),
          ]),
        ],
      },
    ]),
  );
  function snapshot(card: CardInstance): ObjectSnapshot {
    const face = table.defs[card.defId]?.faces[card.faceIndex];
    return {
      ...card,
      physicalCardId: card.id,
      objectId: objectIdOf(card),
      typeLine: face?.typeLine ?? '',
      power: face?.power,
      toughness: face?.toughness,
    };
  }
  for (const entry of table.stack) {
    const targets: TargetSelection[] = entry.targets.flatMap((id, index): TargetSelection[] => {
      const base = { slotId: String(index), raw: '', legalityMode: 'unchecked-warning' as const };
      if (table.seats.some((seat) => seat.id === id))
        return [{ ...base, kind: 'player', selection: { kind: 'player', playerId: id } }];
      const target = entry.targetSnapshots?.[id] ?? table.cards[id];
      return target
        ? [
            {
              ...base,
              kind: 'object',
              selection: {
                kind: 'object',
                physicalCardId: id,
                objectId: objectIdOf(target),
                snapshot: snapshot(target),
              },
            },
          ]
        : [];
    });
    cards[entry.id] = {
      ...entry.source,
      id: entry.id,
      zone: 'stack',
      tapped: false,
      effectsAuto: false,
      controllerId: entry.controllerId,
      isAbility: entry.kind !== 'spell',
      ...(entry.kind !== 'spell'
        ? {
            sourceId: entry.source.id,
            sourceSnapshot: snapshot(entry.source),
            abilityKind: entry.kind,
            abilityResolutionText: entry.text,
          }
        : {}),
      targetSelections: targets,
      manualKeywords: entry.source.manualKeywords ?? [],
    };
  }
  const combat: CombatState | null = table.combat
    ? {
        combatId: `table-${table.turn}`,
        turn: table.turn,
        step: table.combat.damageApplied
          ? 'combatDamage'
          : table.combat.blockers.length
            ? 'declareBlockers'
            : 'declareAttackers',
        attackingPlayerId: table.activeSeatId,
        defendingPlayerId:
          table.combat.attackers[0]?.defendingSeatId ??
          table.combat.attackers[0]?.targetId ??
          ownId,
        attackers: table.combat.attackers.map((attacker, declaredOrder) => ({
          cardId: attacker.cardId,
          objectId: attacker.objectId,
          controllerId: table.cards[attacker.cardId]?.controllerId ?? table.activeSeatId,
          target: table.cards[attacker.targetId]
            ? {
                type: 'battle',
                playerId: attacker.defendingSeatId ?? table.cards[attacker.targetId].controllerId,
                cardId: attacker.targetId,
                objectId: objectIdOf(table.cards[attacker.targetId]),
              }
            : { type: 'player', playerId: attacker.targetId },
          blockedBy: table
            .combat!.blockers.filter((blocker) => blocker.attackerIds.includes(attacker.cardId))
            .map((blocker) => blocker.cardId),
          declaredOrder,
        })),
        blockers: table.combat.blockers.map((blocker, declaredOrder) => ({
          cardId: blocker.cardId,
          objectId: blocker.objectId,
          controllerId: table.cards[blocker.cardId]?.controllerId ?? ownId,
          blocking: blocker.attackerIds,
          declaredOrder,
        })),
      }
    : null;
  return {
    defs: table.defs,
    cards,
    zones: {
      ...own.zones,
      battlefield: Object.values(table.cards)
        .filter((card) => card.zone === 'battlefield' && card.controllerId === ownId)
        .map((card) => card.id),
      stack: table.stack.map((entry) => entry.id).reverse(),
    },
    zonesByPlayer: Object.fromEntries(
      table.seats.map((seat) => [
        seat.id,
        {
          library: seat.id === ownId ? seat.zones.library : [],
          hand: seat.id === ownId ? seat.zones.hand : [],
          graveyard: seat.zones.graveyard,
        },
      ]),
    ),
    commanders: Object.values(table.cards)
      .filter((card) => card.isCommander && card.ownerId === ownId)
      .map((card) => ({ cardId: card.id, castCount: table.commanderCasts[card.id] ?? 0 })),
    effectsAuto: false,
    activePlayerId: table.activeSeatId,
    localPlayerId: ownId,
    turnOrder: table.seats
      .filter((seat) => !seat.eliminated && seat.controller === 'human')
      .map((seat) => seat.id),
    players: Object.fromEntries(
      table.seats.map((seat) => [
        seat.id,
        {
          id: seat.id,
          label: seat.label,
          life: seat.life,
          manaPool: seat.mana,
          poison: seat.counters.poison ?? 0,
          energy: seat.counters.energy ?? 0,
          experience: seat.counters.experience ?? 0,
          mulliganCount: seat.mulligans,
          maximumHandSizeOverride: seat.maximumHandSize ?? 'none',
          landsPlayedThisTurn: 0,
          spellsCastThisTurn: 0,
          drawnThisTurn: 0,
        },
      ]),
    ),
    turn: table.turn,
    phase: table.phase,
    combat,
    life: own.life,
    poison: own.counters.poison ?? 0,
    energy: own.counters.energy ?? 0,
    experience: own.counters.experience ?? 0,
    commanderDamage: own.commanderDamage,
    opponentLife: Object.fromEntries(
      table.seats.filter((seat) => seat.id !== ownId).map((seat) => [seat.label, seat.life]),
    ),
    defeat: {},
    emptyLibraryDrawAttemptedSinceLastSba: {},
    manaPool: own.mana,
    mulliganCount: own.mulligans,
    landsPlayedThisTurn: 0,
    spellsCastThisTurn: 0,
    drawnThisTurn: 0,
    combatDamagePreventedUntilEndOfTurn: false,
    eventLog: [],
    pendingTriggers: [],
    oncePerTurnTriggerLedger: { turn: table.turn, consumedKeys: [] },
    powerUpActivated: {},
    pendingRuleChoices: [],
    pendingSbaChoices: [],
    linkedExiles: Object.fromEntries(table.linkedExiles.map((link) => [link.linkId, link])),
    log: [],
  };
}
