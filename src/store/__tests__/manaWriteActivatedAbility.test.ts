import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find(
    (instance) => instance.defId === defId,
  );
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

function moveToBattlefield(cardId: string): void {
  store().moveCard(cardId, 'battlefield', 'bottom');
}

describe('mana:write activated mana ability catalog', () => {
  beforeEach(() => {
    resetStore();
  });

  it('resolves literal multi-symbol mana abilities immediately without a stack object', () => {
    const source = makeDef({
      scryfallId: 'mana-write-literal',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'mana-write-literal',
          typeLine: 'Artifact',
          oracleText: '{T}: Add {W}{U}.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 1);
    const sourceId = findInstanceId('mana-write-literal');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(true);
    expect(store().state!.manaPool.W).toBe(1);
    expect(store().state!.manaPool.U).toBe(1);
  });

  it('routes auto-cast mana activations through the CR 605 transaction', () => {
    const land = makeDef({
      scryfallId: 'auto-cast-mana-land',
      typeLine: 'Land',
      producedMana: ['G'],
      faces: [
        {
          name: 'auto-cast-mana-land',
          typeLine: 'Land',
          oracleText: '{T}: Add {G}.',
        },
      ],
    });
    const watcher = makeDef({
      scryfallId: 'auto-cast-mana-watcher',
      typeLine: 'Enchantment',
      faces: [
        {
          name: 'auto-cast-mana-watcher',
          typeLine: 'Enchantment',
          oracleText:
            'Whenever a player taps a land for mana, that player adds one mana of any type that land produced.',
        },
      ],
    });
    const spell = makeDef({
      scryfallId: 'auto-cast-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'auto-cast-spell',
          typeLine: 'Sorcery',
          manaCost: '{1}',
        },
      ],
    });

    store().newGame(
      [
        { def: land, isCommander: false },
        { def: watcher, isCommander: false },
        { def: spell, isCommander: false },
        ...makeDeck(10),
      ],
      1,
    );
    const landId = findInstanceId('auto-cast-mana-land');
    const watcherId = findInstanceId('auto-cast-mana-watcher');
    const spellId = findInstanceId('auto-cast-spell');
    moveToBattlefield(landId);
    moveToBattlefield(watcherId);
    store().moveCard(spellId, 'hand', 'bottom');

    expect(store().castToStack(spellId)).toBe('ok');

    expect(store().state!.cards[landId].tapped).toBe(true);
    expect(store().state!.manaPool.G).toBe(1);
    expect(store().state!.pendingTriggers).toEqual([]);
    expect(store().state!.zones.stack).toContain(spellId);
  });

  it('pays fixed life costs before resolving no-stack mana abilities', () => {
    const source = makeDef({
      scryfallId: 'mana-write-pay-life',
      typeLine: 'Land',
      faces: [
        {
          name: 'mana-write-pay-life',
          typeLine: 'Land',
          oracleText: 'Pay 1 life, {T}: Add {R}.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 1);
    const sourceId = findInstanceId('mana-write-pay-life');
    moveToBattlefield(sourceId);
    const beforeLife = store().state!.life;
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(true);
    expect(store().state!.life).toBe(beforeLife - 1);
    expect(store().state!.manaPool.R).toBe(1);
  });

  it('blocks unpayable fixed life costs on mana abilities in rules-legal mode', () => {
    const source = makeDef({
      scryfallId: 'mana-write-pay-life-blocked',
      typeLine: 'Land',
      faces: [
        {
          name: 'mana-write-pay-life-blocked',
          typeLine: 'Land',
          oracleText: 'Pay 1 life, {T}: Add {R}.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 1);
    const sourceId = findInstanceId('mana-write-pay-life-blocked');
    moveToBattlefield(sourceId);
    useGameStore.setState({ state: { ...store().state!, life: 0 } });
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(false);
    expect(store().state!.life).toBe(0);
    expect(store().state!.manaPool.R).toBe(0);
    expect(store().warnings.some((warning) => warning.includes('ライフコスト'))).toBe(true);
  });

  it('guides any-color mana choice, then resolves through the mana transaction with stack 0', () => {
    const source = makeDef({
      scryfallId: 'mana-write-any-color',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'mana-write-any-color',
          typeLine: 'Artifact',
          oracleText: '{T}: Add one mana of any color.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 2);
    const sourceId = findInstanceId('mana-write-any-color');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided?.mode).toBe('mana-ability');
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'mana',
      manaOptions: ['W', 'U', 'B', 'R', 'G'],
    });
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(false);

    store().confirmGuidedMana('U');

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(true);
    expect(store().state!.manaPool.U).toBe(1);
  });

  it('uses commander color identity as the guided option set', () => {
    const source = makeDef({
      scryfallId: 'mana-write-arcane-signet',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'mana-write-arcane-signet',
          typeLine: 'Artifact',
          oracleText: "{T}: Add one mana of any color in your commander's color identity.",
        },
      ],
    });
    const commander = makeDef({
      scryfallId: 'mana-write-commander',
      typeLine: 'Legendary Creature',
      colorIdentity: ['U', 'B'],
      faces: [{ name: 'mana-write-commander', typeLine: 'Legendary Creature' }],
    });

    store().newGame(
      [{ def: source, isCommander: false }, ...makeDeck(10, [commander])],
      3,
    );
    const sourceId = findInstanceId('mana-write-arcane-signet');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'mana',
      manaOptions: ['U', 'B'],
    });

    store().confirmGuidedMana('B');

    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.manaPool.B).toBe(1);
  });

  it('keeps restricted mana manual and does not tap or add mana automatically', () => {
    const source = makeDef({
      scryfallId: 'mana-write-restricted',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'mana-write-restricted',
          typeLine: 'Artifact',
          oracleText:
            '{T}: Add one mana of any color. Spend this mana only to cast creature spells.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 4);
    const sourceId = findInstanceId('mana-write-restricted');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(false);
    expect(store().state!.manaPool.W).toBe(0);
    expect(store().warnings.some((warning) => warning.includes('手動'))).toBe(true);
  });

  it('assists The Enigma Jewel fixed restricted mana without using the stack', () => {
    const source = makeDef({
      scryfallId: 'the-enigma-jewel',
      name: 'The Enigma Jewel',
      printedName: '奇怪な宝石',
      typeLine: 'Legendary Artifact',
      faces: [{
        name: 'The Enigma Jewel',
        printedName: '奇怪な宝石',
        typeLine: 'Legendary Artifact',
        oracleText: '{T}: Add {C}{C}. Spend this mana only to activate abilities.',
      }],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 41);
    const sourceId = findInstanceId('the-enigma-jewel');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0, { assistRestrictedMana: true });

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(true);
    expect(store().state!.manaPool.C).toBe(2);
    expect(store().warnings).toContainEqual(expect.stringContaining('能力の起動にのみ使用'));

    store().undo();
    expect(store().state!.cards[sourceId].tapped).toBe(false);
    expect(store().state!.manaPool.C).toBe(0);
  });

  it('assists Omen Hawker literal mixed restricted mana atomically', () => {
    const source = makeDef({
      scryfallId: 'omen-hawker',
      name: 'Omen Hawker',
      printedName: '前兆の行商人',
      typeLine: 'Creature — Cephalid Advisor',
      faces: [{
        name: 'Omen Hawker',
        printedName: '前兆の行商人',
        typeLine: 'Creature — Cephalid Advisor',
        oracleText: '{T}: Add {C}{U}. Spend this mana only to activate abilities.',
      }],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 42);
    const sourceId = findInstanceId('omen-hawker');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0, { assistRestrictedMana: true });

    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(true);
    expect(store().state!.manaPool.C).toBe(1);
    expect(store().state!.manaPool.U).toBe(1);
    expect(store().warnings).toContainEqual(expect.stringContaining('用途制限は手動'));
  });

  it('keeps targeted add-mana abilities on the ordinary activation stack path', () => {
    const source = makeDef({
      scryfallId: 'mana-write-targeted',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'mana-write-targeted',
          typeLine: 'Artifact',
          oracleText: '{T}: Target player adds {G}.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 5);
    const sourceId = findInstanceId('mana-write-targeted');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided?.mode).toBe('activation');
    expect(store().pendingGuided?.prompts[0]?.targetKind).toBe('player');
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.manaPool.G).toBe(0);

    store().confirmGuidedPlayerTarget('P1');

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.zones.stack).toHaveLength(1);
    expect(store().state!.manaPool.G).toBe(0);
  });
});
