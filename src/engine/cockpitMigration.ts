import { splitAbilityLines } from './grammar/index';
import type { GameSnapshot } from '../data/gameSnapshot';
import {
  assertCockpitCardDef,
  createCockpitTable,
  emptyTableMana,
  tableZones,
  type CockpitTable,
  type TableSeat,
} from './cockpitTable';

/** One-way import. The original IndexedDB snapshot is never rewritten. */
export function migrateCockpitSnapshot(snapshot: GameSnapshot): CockpitTable {
  if (snapshot.version !== 1 || !snapshot.state || !Array.isArray(snapshot.deck))
    throw new Error('旧保存の形式を確認できません。元の保存は保持しています。');
  const old = snapshot.state;
  const unsupported = [
    Object.keys(old.defeat ?? {}).length && '敗北条件の確認待ち',
    old.pendingTriggers?.length && '未配置の誘発',
    old.pendingRuleChoices?.length && '未確定のルール選択',
    old.pendingSbaChoices?.length && '未確定の統率者移動',
    Object.keys(old.dungeons ?? {}).length && 'ダンジョン',
    old.combatDamagePreventedUntilEndOfTurn && '戦闘ダメージ軽減',
    Object.keys(old.powerUpActivated ?? {}).length && '起動済みの期限情報',
  ].filter(Boolean);
  if (unsupported.length)
    throw new Error(
      `この旧保存はまだ移行できません: ${unsupported.join('、')}。元の保存を保持しています。`,
    );
  const table = createCockpitTable(snapshot.deck, 1);
  // The ordinary passive seat exists even when a legacy solo had an empty opponent.
  const trainingCards = Object.values(table.cards).filter((card) => card.ownerId === 'P2');
  const originalIds = old.turnOrder?.length ? old.turnOrder : ['P1', 'OPPONENT_A'];
  const ids = [
    ...new Set([
      ...originalIds,
      ...Object.values(old.cards).flatMap((card) => [card.ownerId, card.controllerId]),
    ]),
  ];
  if (ids.length < 2) ids.push('OPPONENT_A');
  for (const def of Object.values(old.defs)) assertCockpitCardDef(def);
  table.defs = { ...table.defs, ...structuredClone(old.defs) };
  table.cards = structuredClone(old.cards);
  table.grants = Object.values(table.cards).flatMap((card) =>
    [...new Set(card.manualKeywords ?? [])].map((keyword, index) => ({
      id: `legacy-${card.id}-${index}`,
      cardId: card.id,
      keyword,
      value: keyword === 'ward' ? '旧保存に値の記録なし' : '',
      duration: '旧保存に期限・由来の記録なし。人が確認して解除',
      sourceId: null,
    })),
  );
  table.linkedExiles = structuredClone(Object.values(old.linkedExiles ?? {}));
  if (old.combat)
    table.combat = {
      legacyDeclaration: structuredClone(old.combat),
      attackers: old.combat.attackers.map((entry) => ({
        cardId: entry.cardId,
        objectId: entry.objectId,
        targetId: entry.target.type === 'player' ? entry.target.playerId : entry.target.cardId,
      })),
      blockers: old.combat.blockers.map((entry) => ({
        cardId: entry.cardId,
        objectId: entry.objectId,
        attackerIds: [...entry.blocking],
      })),
      assignments: [],
      damageApplied: old.combat.step === 'endOfCombat',
      damageStep: old.combat.step === 'endOfCombat' ? 2 : 1,
    };
  table.seats = ids.map((id, index): TableSeat => {
    const player = old.players?.[id];
    const local = id === old.localPlayerId;
    const zones = {
      library: [],
      hand: [],
      battlefield: [],
      graveyard: [],
      exile: [],
      command: [],
      stack: [],
    } as TableSeat['zones'];
    for (const zone of tableZones) {
      const ordered =
        zone === 'library' || zone === 'hand' || zone === 'graveyard'
          ? (old.zonesByPlayer?.[id]?.[zone] ?? (local ? old.zones[zone] : []))
          : old.zones[zone].filter((cardId) => old.cards[cardId]?.ownerId === id);
      zones[zone] = [...ordered];
    }
    return {
      id,
      label: local ? 'あなた' : (player?.label ?? `受け身Bot ${index}`),
      controller: local ? 'human' : 'passive',
      life: local ? old.life : (player?.life ?? 40),
      mana: structuredClone(local ? old.manaPool : (player?.manaPool ?? emptyTableMana())),
      counters: {
        poison: local ? old.poison : (player?.poison ?? 0),
        energy: local ? old.energy : (player?.energy ?? 0),
        experience: local ? old.experience : (player?.experience ?? 0),
      },
      commanderDamage: local ? structuredClone(old.commanderDamage) : {},
      maximumHandSize:
        player?.maximumHandSizeOverride === 'none' ? null : (player?.maximumHandSizeOverride ?? 7),
      zones,
      kept: true,
      mulligans: local ? old.mulliganCount : (player?.mulliganCount ?? 0),
      eliminated: false,
    };
  });
  const emptyOpponent = table.seats.find(
    (seat) =>
      seat.controller === 'passive' && tableZones.every((zone) => seat.zones[zone].length === 0),
  );
  if (emptyOpponent)
    for (const card of trainingCards) {
      if (table.cards[card.id]) throw new Error('旧保存のカードIDが競合しています。');
      card.ownerId = emptyOpponent.id;
      card.controllerId = emptyOpponent.id;
      table.cards[card.id] = card;
      emptyOpponent.zones[card.zone].push(card.id);
    }
  const seen = new Set<string>();
  for (const seat of table.seats)
    for (const zone of tableZones)
      for (const id of seat.zones[zone]) {
        const card = table.cards[id];
        if (!card || card.zone !== zone || seen.has(id) || !table.defs[card.defId])
          throw new Error('旧保存の領域情報が一致しません。');
        seen.add(id);
      }
  if (seen.size !== Object.keys(table.cards).length)
    throw new Error('旧保存に所在を確認できないカードがあります。');
  table.turn = old.turn;
  table.phase = old.phase;
  table.activeSeatId = old.activePlayerId;
  table.commanderCasts = Object.fromEntries(
    old.commanders.map((entry) => [entry.cardId, entry.castCount]),
  );
  table.stack = old.zones.stack.map((id) => {
    const card = table.cards[id];
    const snapshot = card.sourceSnapshot ?? card.activationEnvelope?.sourceRef.snapshot;
    const source = structuredClone(
      card.sourceId && table.cards[card.sourceId] ? table.cards[card.sourceId] : card,
    );
    if (snapshot) {
      const incarnation = Number(snapshot.objectId.slice(snapshot.objectId.lastIndexOf(':') + 1));
      Object.assign(source, {
        id: snapshot.physicalCardId,
        defId: snapshot.defId,
        zone: snapshot.zone,
        ownerId: snapshot.ownerId,
        controllerId: snapshot.controllerId ?? snapshot.ownerId,
        zoneChangeCounter: Number.isSafeInteger(incarnation)
          ? incarnation
          : source.zoneChangeCounter,
        faceIndex: snapshot.faceIndex,
        tapped: snapshot.tapped,
        counters: structuredClone(snapshot.counters),
        isToken: snapshot.isToken,
        isCommander: snapshot.isCommander,
        sourceSnapshot: structuredClone(snapshot),
      });
    }
    // Preserve the historical object references and cost declarations, even if the physical source has moved.
    source.targetSelections = structuredClone(
      card.targetSelections ?? card.activationEnvelope?.targetSelections ?? [],
    );
    source.activationEnvelope = structuredClone(card.activationEnvelope);
    const sourceDef = table.defs[source.defId];
    const abilityLine =
      card.abilityLineIndex === undefined || !sourceDef
        ? undefined
        : splitAbilityLines(sourceDef)[card.abilityLineIndex]?.text;
    return {
      id: `${id}:${card.zoneChangeCounter}`,
      stackCardId: id,
      copied: card.isCopy ?? false,
      kind: card.isAbility ? (card.abilityKind ?? 'activated') : 'spell',
      source,
      controllerId: card.controllerId,
      targets: source.targetSelections.map((target) =>
        target.selection.kind === 'player'
          ? target.selection.playerId
          : target.selection.physicalCardId,
      ),
      paid: [],
      costNote: `旧保存の支払済みコスト。再要求しません。${card.activationEnvelope?.cost.map((cost) => cost.raw).join(' / ') ?? ''}`,
      text:
        card.abilityResolutionText ??
        abilityLine ??
        table.defs[card.defId]?.faces[card.faceIndex]?.oracleText ??
        '',
    };
  });
  return table;
}
