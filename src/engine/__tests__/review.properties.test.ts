/**
 * Reviewer-owned property tests for engine invariants (docs/engine-spec.md §1/§34.42-45).
 * Implementation agents must NOT modify this file.
 * (J0拡張 2026-07-15 → 判定者が全hunk精読=強化のみと確認し再オーナー化 2026-07-16。)
 *
 * Strategy: a PRNG-driven random walk over valid-ish commands generated from the
 * current state. The input state is deep-frozen before every applyCommand call,
 * so any mutation of the previous state throws TypeError (I4).
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { CardDef } from '../../types/card';
import { applyCommand, type GameCommand } from '../commands';
import { initGame, type InitDeckCard } from '../init';
import { createRng, shuffledOrder } from '../random';
import { playerIdForLifeLabel, requirePlayer, type GameState, type ZoneId } from '../types';
import { useGameStore } from '../../store/gameStore';

const ZONES: ZoneId[] = ['library', 'hand', 'battlefield', 'graveyard', 'exile', 'command', 'stack'];

function def(name: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    scryfallId: `sf-${name}`,
    oracleId: `or-${name}`,
    name,
    lang: 'en',
    layout: 'normal',
    cmc: 2,
    colorIdentity: ['R'],
    typeLine: 'Creature — Dragon',
    faces: [{ name, typeLine: 'Creature — Dragon', manaCost: '{1}{R}' }],
    ...overrides,
  };
}

function makeDeck(size: number): InitDeckCard[] {
  const deck: InitDeckCard[] = [];
  deck.push({
    def: def('Commander Dragon', { typeLine: 'Legendary Creature — Dragon' }),
    isCommander: true,
  });
  for (let i = 1; i < size; i++) {
    const kind = i % 4;
    if (kind === 0) {
      deck.push({
        def: def(`Mountain ${i}`, {
          typeLine: 'Basic Land — Mountain',
          cmc: 0,
          producedMana: ['R'],
          faces: [{ name: `Mountain ${i}`, typeLine: 'Basic Land — Mountain' }],
        }),
        isCommander: false,
      });
    } else if (kind === 1) {
      deck.push({
        def: def(`Bolt ${i}`, {
          typeLine: 'Instant',
          faces: [{ name: `Bolt ${i}`, typeLine: 'Instant', manaCost: '{R}' }],
        }),
        isCommander: false,
      });
    } else {
      deck.push({ def: def(`Dragon ${i}`), isCommander: false });
    }
  }
  // I57 (CR720 §34.53): the last slot is an omen-layout card so the walk can
  // exercise the castAsOmen stack-only cast choice (cold-audit FINDING-1,
  // 2026-08-04). Replacing an existing slot keeps the card count at deckSize.
  const omenSlot: InitDeckCard = {
    def: def('Omen Card', {
      layout: 'omen',
      typeLine: 'Instant',
      faces: [
        { name: 'Omen Card', typeLine: 'Instant', manaCost: '{1}' },
        { name: 'Omen Card — Omen', typeLine: 'Instant', manaCost: '{1}' },
      ],
    }),
    isCommander: false,
  };
  deck[deck.length - 1] = omenSlot;
  return deck;
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const value of Object.values(obj)) {
      deepFreeze(value);
    }
  }
  return obj;
}

/** Generate a plausible command from the current state, driven by PRNG values. */
function genCommand(state: GameState, rng: () => number): GameCommand {
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const allIds = Object.keys(state.cards);
  const kinds = [
    'moveCard',
    'setTapped',
    'addCounters',
    'adjustLife',
    'adjustPlayerCounter',
    'addMana',
    'payMana',
    'clearManaPool',
    'draw',
    'shuffle',
    'nextPhase',
    'nextTurn',
    'createToken',
    'castSpell',
    'castCommander',
    'mulligan',
    'putOnBottom',
    'playLand',
    'crackTreasure',
    'adjustOpponentLife',
    'arrangeTop',
    'mill',
    'untapAll',
    'discard',
    'createScenarioDummy',
    'setClassLevel',
    'castOmen',
  ] as const;
  const kind = pick([...kinds]);

  switch (kind) {
    case 'moveCard': {
      const cardId = pick(allIds);
      const to = pick(ZONES);
      const position = pick<'top' | 'bottom' | number>(['top', 'bottom', Math.floor(rng() * 10)]);
      return { type: 'moveCard', cardId, to, position };
    }
    case 'setTapped':
      return { type: 'setTapped', cardId: pick(allIds), tapped: rng() < 0.5 };
    case 'setClassLevel':
      return { type: 'setClassLevel', cardId: pick(allIds), level: Math.floor(rng() * 3) + 1 };
    case 'castOmen': {
      const omenId = state.zones.hand.find(
        (id) => state.defs[state.cards[id]?.defId ?? '']?.layout === 'omen',
      );
      if (!omenId) return { type: 'nextPhase' };
      return {
        type: 'castToStack',
        cardId: omenId,
        payment: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        forced: true,
        faceIndex: 1,
        castAsOmen: true,
      };
    }
    case 'addCounters':
      return {
        type: 'addCounters',
        cardId: pick(allIds),
        counterType: pick(['+1/+1', 'charge', 'loyalty']),
        delta: Math.floor(rng() * 7) - 3,
      };
    case 'adjustLife':
      return {
        type: 'adjustLife',
        playerId: pick(state.turnOrder),
        delta: Math.floor(rng() * 21) - 10,
      };
    case 'adjustPlayerCounter':
      return {
        type: 'adjustPlayerCounter',
        kind: pick(['poison', 'energy', 'experience']),
        playerId: pick(state.turnOrder),
        delta: Math.floor(rng() * 7) - 3,
      };
    case 'addMana':
      return {
        type: 'addMana',
        color: pick(['W', 'U', 'B', 'R', 'G', 'C']),
        amount: Math.floor(rng() * 3) + 1,
        playerId: pick(state.turnOrder),
      };
    case 'payMana':
      return {
        type: 'payMana',
        payment: {
          W: 0,
          U: 0,
          B: 0,
          R: Math.floor(rng() * 3),
          G: 0,
          C: Math.floor(rng() * 2),
        },
      };
    case 'clearManaPool':
      return { type: 'clearManaPool' };
    case 'draw':
      return { type: 'draw', count: Math.floor(rng() * 3), playerId: pick(state.turnOrder) };
    case 'shuffle': {
      const playerId = pick(state.turnOrder);
      return {
        type: 'shuffle',
        playerId,
        order: shuffledOrder(state.zonesByPlayer[playerId].library, rng),
      };
    }
    case 'nextPhase':
      return { type: 'nextPhase' };
    case 'nextTurn':
      return { type: 'nextTurn' };
    case 'createToken': {
      if (rng() < 0.4) {
        return {
          type: 'createToken',
          name: '宝物',
          typeLine: 'Token Artifact — Treasure',
          quantity: Math.floor(rng() * 3),
          producedMana: ['W', 'U', 'B', 'R', 'G'],
          tokenKind: 'treasure',
        };
      }
      return {
        type: 'createToken',
        name: 'Soldier',
        typeLine: 'Token Creature — Soldier',
        power: '1',
        toughness: '1',
        quantity: Math.floor(rng() * 3),
      };
    }
    case 'playLand': {
      const handLands = state.zones.hand.filter((id) => {
        const def = state.defs[state.cards[id].defId];
        return (def?.typeLine ?? '').includes('Land');
      });
      if (handLands.length === 0) return { type: 'nextPhase' };
      return { type: 'playLand', cardId: pick(handLands), forced: rng() < 0.5 };
    }
    case 'crackTreasure': {
      const treasures = state.zones.battlefield.filter(
        (id) => state.defs[state.cards[id].defId]?.tokenKind === 'treasure',
      );
      if (treasures.length === 0) return { type: 'nextPhase' };
      return {
        type: 'crackTreasure',
        cardId: pick(treasures),
        color: pick(['W', 'U', 'B', 'R', 'G']),
      };
    }
    case 'adjustOpponentLife':
      return {
        type: 'adjustOpponentLife',
        label: pick(['対戦相手A', 'B', 'C']),
        delta: Math.floor(rng() * 13) - 6,
      };
    case 'arrangeTop': {
      const lib = state.zones.library;
      const n = Math.min(lib.length, 1 + Math.floor(rng() * 3));
      if (n === 0) return { type: 'nextPhase' };
      const top = lib.slice(0, n);
      const topOrder: string[] = [];
      const toBottom: string[] = [];
      const toGraveyard: string[] = [];
      for (const id of top) {
        const r = rng();
        if (r < 0.5) topOrder.push(id);
        else if (r < 0.8) toBottom.push(id);
        else toGraveyard.push(id);
      }
      return { type: 'arrangeTop', topOrder, toBottom, toGraveyard };
    }
    case 'mill':
      return { type: 'mill', count: Math.floor(rng() * 4), playerId: pick(state.turnOrder) };
    case 'untapAll':
      return { type: 'untapAll' };
    case 'discard': {
      const playerId = pick(state.turnOrder);
      const hand = state.zonesByPlayer[playerId].hand;
      if (hand.length === 0) return { type: 'nextPhase' };
      const k = 1 + Math.floor(rng() * Math.min(2, hand.length));
      return { type: 'discard', cardIds: hand.slice(0, k), playerId };
    }
    case 'createScenarioDummy': {
      let next = 1;
      while (state.cards[`property-dummy-${next}`] || state.defs[`property-dummy-def-${next}`]) {
        next += 1;
      }
      return {
        type: 'createScenarioDummy',
        cardId: `property-dummy-${next}`,
        defId: `property-dummy-def-${next}`,
        playerId: pick(state.turnOrder),
        name: `検証ダミー${next}`,
        typeLine: rng() < 0.5 ? 'Creature' : 'Artifact',
        power: '1',
        toughness: '1',
        tapped: rng() < 0.5,
        counters: {},
        keywords: [],
        isToken: rng() < 0.5,
      };
    }
    case 'castSpell': {
      if (state.zones.hand.length === 0) return { type: 'nextPhase' };
      return {
        type: 'castSpell',
        cardId: pick(state.zones.hand),
        payment: { W: 0, U: 0, B: 0, R: Math.floor(rng() * 2), G: 0, C: 0 },
        forced: true,
      };
    }
    case 'castCommander': {
      const inCommand = state.commanders.find(
        (c) => state.cards[c.cardId]?.zone === 'command',
      );
      if (!inCommand) return { type: 'nextPhase' };
      return {
        type: 'castCommander',
        cardId: inCommand.cardId,
        payment: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        forced: true,
      };
    }
    case 'mulligan': {
      const combined = [...state.zones.hand, ...state.zones.library];
      return { type: 'mulligan', order: shuffledOrder(combined, rng) };
    }
    case 'putOnBottom': {
      if (state.zones.hand.length === 0) return { type: 'nextPhase' };
      return { type: 'putOnBottom', cardIds: [pick(state.zones.hand)] };
    }
  }
}

function checkInvariants(state: GameState, deckSize: number, label: string): void {
  // I1: each card id appears in exactly one zone, zones <-> cards consistent
  const seen = new Map<string, ZoneId>();
  for (const zone of ['battlefield', 'exile', 'command', 'stack'] as const) {
    for (const id of state.zones[zone]) {
      expect(seen.has(id), `${label}: ${id} appears in ${seen.get(id)} and ${zone}`).toBe(false);
      seen.set(id, zone);
      expect(state.cards[id], `${label}: ${id} in zones but not in cards`).toBeDefined();
      expect(state.cards[id].zone, `${label}: ${id} zone field mismatch`).toBe(zone);
    }
  }
  for (const [playerId, zones] of Object.entries(state.zonesByPlayer)) {
    for (const zone of ['library', 'hand', 'graveyard'] as const) {
      for (const id of zones[zone]) {
        expect(seen.has(id), `${label}: ${id} duplicated in ${playerId}/${zone}`).toBe(false);
        seen.set(id, zone);
        expect(state.cards[id], `${label}: ${id} in private zone but missing`).toBeDefined();
        expect(state.cards[id].zone).toBe(zone);
        expect(state.cards[id].ownerId).toBe(playerId);
      }
    }
  }
  expect(Object.keys(state.cards).length, `${label}: cards not all in zones`).toBe(seen.size);

  // I2: non-token AND non-ability AND non-copy count is constant
  // (M4.27: ability objects excluded; M4.28: copy objects excluded)
  const nonTokens = Object.values(state.cards).filter(
    (c) => !c.isToken && !c.isAbility && !c.isCopy && !c.isScenarioDummy
  ).length;
  expect(nonTokens, `${label}: non-token count drifted`).toBe(deckSize);

  // I2b: tokens only ever exist on the battlefield
  for (const c of Object.values(state.cards)) {
    if (c.isToken) {
      expect(c.zone, `${label}: token ${c.id} in non-battlefield zone`).toBe('battlefield');
    }
  }

  // I9 (M4.27): ability objects live only on the stack; their source/def exist
  for (const c of Object.values(state.cards)) {
    if (c.isAbility) {
      expect(c.zone, `${label}: ability ${c.id} not on stack`).toBe('stack');
      expect(c.sourceId, `${label}: ability ${c.id} has no sourceId`).toBeDefined();
      expect(
        state.cards[c.sourceId as string],
        `${label}: ability ${c.id} source missing`
      ).toBeDefined();
      expect(state.defs[c.defId], `${label}: ability ${c.id} def missing`).toBeDefined();
    }
  }

  // I3: non-negative pools and counters (life may go negative)
  for (const v of Object.values(state.manaPool)) {
    expect(v, `${label}: negative mana`).toBeGreaterThanOrEqual(0);
  }
  expect(state.poison).toBeGreaterThanOrEqual(0);
  expect(state.energy).toBeGreaterThanOrEqual(0);
  expect(state.experience).toBeGreaterThanOrEqual(0);
  for (const c of Object.values(state.cards)) {
    for (const v of Object.values(c.counters)) {
      expect(v, `${label}: negative card counter`).toBeGreaterThanOrEqual(0);
    }
    // I3 (S-SBA damage-marked): marked damage is never negative (CR 120.3).
    expect(c.damageMarked, `${label}: negative damageMarked on ${c.id}`).toBeGreaterThanOrEqual(0);
  }
  for (const v of Object.values(state.commanderDamage)) {
    expect(v).toBeGreaterThanOrEqual(0);
  }

  // I3 (S-COMBAT): combat context is null unless it is this turn's combat phase,
  // and every combat participant references a real card (CR 506.1).
  if (state.combat !== null) {
    expect(state.phase, `${label}: combat set outside combat phase`).toBe('combat');
    expect(state.combat.turn, `${label}: combat.turn != state.turn`).toBe(state.turn);
    for (const p of [...state.combat.attackers, ...state.combat.blockers]) {
      expect(state.cards[p.cardId], `${label}: combat participant ${p.cardId} missing`).toBeDefined();
    }
  }

  // I6: lands-played counter is never negative
  expect(state.landsPlayedThisTurn, `${label}: negative landsPlayedThisTurn`).toBeGreaterThanOrEqual(0);

  // I7: enteredTurn is set on the battlefield, cleared elsewhere
  for (const c of Object.values(state.cards)) {
    if (c.zone === 'battlefield') {
      expect(c.enteredTurn, `${label}: ${c.id} bad enteredTurn`).toBeGreaterThanOrEqual(1);
      expect(c.enteredTurn, `${label}: ${c.id} enteredTurn in future`).toBeLessThanOrEqual(state.turn);
    } else {
      expect(c.enteredTurn, `${label}: ${c.id} enteredTurn not cleared`).toBe(0);
    }
  }

  // I10 (M4.28): copy objects live only on the stack; their def exists
  for (const c of Object.values(state.cards)) {
    if (c.isCopy) {
      expect(c.zone, `${label}: copy ${c.id} off stack`).toBe('stack');
      expect(state.defs[c.defId], `${label}: copy ${c.id} def missing`).toBeDefined();
    }
  }

  // I11/I12 (M4.30): per-turn counters are non-negative
  expect(state.spellsCastThisTurn, `${label}: negative spellsCastThisTurn`).toBeGreaterThanOrEqual(0);
  expect(state.drawnThisTurn, `${label}: negative drawnThisTurn`).toBeGreaterThanOrEqual(0);

  // I13 (S-SBA defeat-state, §34.15/§34.16): every defeat advisory record is well-formed
  // per CR 704.5a/b/c + 903.10a — advisory (never enforcing), non-empty & de-duplicated
  // reasons drawn from the four known kinds, each carrying its matching CR ref.
  const DEFEAT_RULE: Record<string, string> = {
    lifeZero: '704.5a',
    emptyLibraryDraw: '704.5b',
    poison: '704.5c',
    commanderDamage: '903.10a',
  };
  for (const [ref, rec] of Object.entries(state.defeat)) {
    expect(rec, `${label}: defeat[${ref}] undefined`).toBeDefined();
    if (!rec) continue;
    expect(rec.advisory, `${label}: defeat[${ref}] not advisory`).toBe(true);
    expect(rec.reasons.length, `${label}: defeat[${ref}] empty reasons`).toBeGreaterThan(0);
    expect(new Set(rec.reasons).size, `${label}: defeat[${ref}] duplicate reason`).toBe(
      rec.reasons.length
    );
    for (const reason of rec.reasons) {
      expect(DEFEAT_RULE[reason], `${label}: defeat[${ref}] unknown reason ${reason}`).toBeDefined();
      expect(rec.ruleRefs[reason], `${label}: defeat[${ref}] ruleRef mismatch for ${reason}`).toBe(
        DEFEAT_RULE[reason]
      );
    }
  }
  // I13b: empty-library-draw interval flags are booleans (CR 704.5b interval).
  for (const [pid, flag] of Object.entries(state.emptyLibraryDrawAttemptedSinceLastSba)) {
    expect(typeof flag, `${label}: emptyLibraryDraw flag for ${pid} not boolean`).toBe('boolean');
  }

  // I24-I26: roster/turn order, local projection, and opponent compatibility view.
  const playerIds = Object.keys(state.players);
  expect(new Set(state.turnOrder).size, `${label}: duplicate turnOrder`).toBe(state.turnOrder.length);
  expect([...playerIds].sort()).toEqual([...state.turnOrder].sort());
  for (const playerId of playerIds) {
    expect(requirePlayer(state, playerId).id).toBe(playerId);
    expect(state.zonesByPlayer[playerId], `${label}: missing private zones for ${playerId}`).toBeDefined();
  }
  const local = requirePlayer(state, state.localPlayerId);
  expect(local.life).toBe(state.life);
  expect(local.poison).toBe(state.poison);
  expect(local.energy).toBe(state.energy);
  expect(local.experience).toBe(state.experience);
  expect(local.manaPool).toEqual(state.manaPool);
  expect(local.landsPlayedThisTurn).toBe(state.landsPlayedThisTurn);
  expect(local.spellsCastThisTurn).toBe(state.spellsCastThisTurn);
  expect(local.drawnThisTurn).toBe(state.drawnThisTurn);
  for (const [opponentLabel, life] of Object.entries(state.opponentLife)) {
    const player = requirePlayer(state, playerIdForLifeLabel(opponentLabel));
    expect(player.label).toBe(opponentLabel);
    expect(player.life).toBe(life);
  }

  // I29/I31/I32/I33/I36/I37: private mirrors, player event subjects, retention,
  // and typed synthetic-object shape.
  expect(state.zones.library).toEqual(state.zonesByPlayer[state.localPlayerId].library);
  expect(state.zones.hand).toEqual(state.zonesByPlayer[state.localPlayerId].hand);
  expect(state.zones.graveyard).toEqual(state.zonesByPlayer[state.localPlayerId].graveyard);
  for (const event of state.eventLog) {
    if ('playerId' in event && event.playerId !== undefined) {
      expect(state.players[event.playerId], `${label}: event subject is not a player`).toBeDefined();
    }
  }
  for (const playerId of state.turnOrder) {
    const player = requirePlayer(state, playerId);
    expect(player.poison).toBeGreaterThanOrEqual(0);
    for (const amount of Object.values(player.manaPool)) {
      expect(amount).toBeGreaterThanOrEqual(0);
    }
  }
  for (const card of Object.values(state.cards)) {
    expect(state.players[card.ownerId], `${label}: unknown owner ${card.ownerId}`).toBeDefined();
    expect(state.players[card.controllerId], `${label}: unknown controller ${card.controllerId}`).toBeDefined();
    if (!card.isScenarioDummy) continue;
    const scenarioDef = state.defs[card.defId];
    expect(scenarioDef).toBeDefined();
    expect(scenarioDef.faces[0]?.oracleText).toBeUndefined();
    expect(scenarioDef.faces[0]?.imageUrl).toBeUndefined();
  }
  expect(state.players[state.activePlayerId], `${label}: unknown active player`).toBeDefined();
  for (const trigger of state.pendingTriggers) {
    expect(state.players[trigger.controllerId], `${label}: unknown trigger controller`).toBeDefined();
  }
  if (state.combat) {
    expect(state.players[state.combat.attackingPlayerId]).toBeDefined();
    expect(state.players[state.combat.defendingPlayerId]).toBeDefined();
    for (const attacker of state.combat.attackers) {
      expect(state.players[attacker.controllerId]).toBeDefined();
      expect(state.players[attacker.target.playerId]).toBeDefined();
    }
    for (const blocker of state.combat.blockers) {
      expect(state.players[blocker.controllerId]).toBeDefined();
    }
  }
  // I51/I53 (CR716 §34.51): classLevel is either undefined or an integer >= 1,
  // and is independent of counters (CR 716.4). classLevelOf default 1 keeps the
  // effective level >= 1 for every card.
  for (const card of Object.values(state.cards)) {
    if (card.classLevel !== undefined) {
      expect(Number.isInteger(card.classLevel), `${label}: non-integer classLevel`).toBe(true);
      expect(card.classLevel, `${label}: classLevel < 1`).toBeGreaterThanOrEqual(1);
    }
    // I55 (CR719 §34.52): solved is boolean or undefined for every card.
    if (card.solved !== undefined) {
      expect(typeof card.solved, `${label}: solved not boolean`).toBe('boolean');
    }
    // I57 (CR720 §34.53): castAsOmen is a stack-only cast choice (720.3b).
    // Off the stack, only normal characteristics apply (720.4), so the flag
    // must never survive onto a non-stack object.
    if (card.castAsOmen === true) {
      expect(card.zone, `${label}: castAsOmen off the stack`).toBe('stack');
    }
  }
}

const DECK_SIZE = 24;

describe('engine invariants I1-I5 (property)', () => {
  // Heavy fast-check walk; the 5s default and the former 30s timeout are too
  // tight under the parallel core lane (the observed loaded run reached 33s).
  it('hold under random command walks; applyCommand never mutates its input (I4)', { timeout: 60000 }, () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 ** 31 - 1 }),
        fc.integer({ min: 1, max: 60 }),
        (seed, steps) => {
          const rng = createRng(seed);
          const deck = makeDeck(DECK_SIZE);
          let state = initGame(deck, seed);
          checkInvariants(state, DECK_SIZE, 'init');

          for (let i = 0; i < steps; i++) {
            const cmd = genCommand(state, rng);
            deepFreeze(state); // I4: any in-place mutation throws TypeError
            const poolWasCleared = cmd.type === 'nextPhase' || cmd.type === 'nextTurn';
            const result = applyCommand(state, cmd);
            state = result.state;
            checkInvariants(state, DECK_SIZE, `step ${i} ${cmd.type}`);
            if (poolWasCleared && state.phase === 'untap') {
              // I5: phase/turn transitions clear the pool. (Entering draw may
              // not re-add mana either; untap is the easy guaranteed check.)
              const total =
                state.manaPool.W +
                state.manaPool.U +
                state.manaPool.B +
                state.manaPool.R +
                state.manaPool.G +
                state.manaPool.C;
              expect(total, `step ${i}: pool not cleared on turn change`).toBe(0);
              expect(state.landsPlayedThisTurn, `step ${i}: lands counter not reset`).toBe(0);
            }
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  it('I5: every nextPhase clears the pool before entering the next phase', () => {
    const deck = makeDeck(DECK_SIZE);
    let state = initGame(deck, 7);
    state = applyCommand(state, { type: 'addMana', color: 'R', amount: 3 }).state;
    for (let i = 0; i < 14; i++) {
      const before = state.phase;
      state = applyCommand(state, { type: 'nextPhase' }).state;
      const p = state.manaPool;
      const total = p.W + p.U + p.B + p.R + p.G + p.C;
      // pool may only contain mana added during this command (auto effects add none)
      expect(total, `after ${before} -> ${state.phase}`).toBe(0);
      state = applyCommand(state, { type: 'addMana', color: 'G', amount: 2 }).state;
    }
  });
});

describe('store history (snapshot undo/redo)', () => {
  it('undoing everything returns exactly to the opening state; redo restores the end state', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), fc.integer({ min: 1, max: 30 }), (seed, steps) => {
        const store = useGameStore.getState();
        store.newGame(makeDeck(DECK_SIZE), seed);
        const opening = useGameStore.getState().state;
        expect(opening).not.toBeNull();

        const rng = createRng(seed ^ 0x9e3779b9);
        let dispatched = 0;
        for (let i = 0; i < steps; i++) {
          const cur = useGameStore.getState().state;
          if (!cur) break;
          const cmd = genCommand(cur, rng);
          useGameStore.getState().dispatch(cmd);
          dispatched++;
        }

        const endState = useGameStore.getState().state;
        for (let i = 0; i < dispatched; i++) useGameStore.getState().undo();
        expect(useGameStore.getState().state).toEqual(opening);
        expect(useGameStore.getState().canUndo).toBe(false);

        for (let i = 0; i < dispatched; i++) useGameStore.getState().redo();
        expect(useGameStore.getState().state).toEqual(endState);
        expect(useGameStore.getState().canRedo).toBe(false);
      }),
      { numRuns: 25 },
    );
  });
});
// verifies: ENG-STATE-002
