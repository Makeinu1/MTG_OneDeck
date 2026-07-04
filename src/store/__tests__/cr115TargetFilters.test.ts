import { beforeEach, describe, expect, it } from 'vitest';

import { makeDef } from '../../engine/__tests__/helpers';
import type { PlayerId } from '../../engine/types';
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

function setController(cardId: string, controllerId: PlayerId): void {
  const state = store().state;
  const card = state?.cards[cardId];
  if (!state || !card) {
    throw new Error(`card instance not found: ${cardId}`);
  }
  useGameStore.setState({
    state: {
      ...state,
      cards: {
        ...state.cards,
        [cardId]: { ...card, controllerId },
      },
    },
  });
}

describe('CR 115 target filters', () => {
  beforeEach(() => {
    resetStore();
  });

  it('excludes lands from spell targets that say target nonland permanent', () => {
    const spell = makeDef({
      scryfallId: 'cr115-nonland-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr115-nonland-spell',
          typeLine: 'Sorcery',
          oracleText: 'Exile target nonland permanent.',
        },
      ],
    });
    const land = makeDef({
      scryfallId: 'cr115-land-target',
      typeLine: 'Land',
      faces: [{ name: 'cr115-land-target', typeLine: 'Land' }],
    });
    const artifact = makeDef({
      scryfallId: 'cr115-artifact-target',
      typeLine: 'Artifact',
      faces: [{ name: 'cr115-artifact-target', typeLine: 'Artifact' }],
    });

    store().newGame(
      [
        { def: spell, isCommander: false },
        { def: land, isCommander: false },
        { def: artifact, isCommander: false },
      ],
      1,
    );
    const spellId = findInstanceId('cr115-nonland-spell');
    const landId = findInstanceId('cr115-land-target');
    const artifactId = findInstanceId('cr115-artifact-target');
    store().moveCard(spellId, 'stack', 'bottom');
    moveToBattlefield(landId);
    moveToBattlefield(artifactId);

    store().resolveTop();

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.exile',
      kind: 'target',
      filter: { types: ['permanent'], excludedTypes: ['land'] },
    });

    store().confirmGuidedTarget(landId);
    expect(store().state!.cards[landId].zone).toBe('battlefield');
    expect(store().pendingGuided?.prompts[0].kind).toBe('target');
    expect(store().warnings.at(-1)).toContain('対象候補にありません');

    store().confirmGuidedTarget(artifactId);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[artifactId].zone).toBe('exile');
    expect(store().state!.cards[spellId].zone).toBe('graveyard');
  });

  it('excludes lands from activation-time targets before committing the ability', () => {
    const source = makeDef({
      scryfallId: 'cr115-nonland-ability',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'cr115-nonland-ability',
          typeLine: 'Artifact',
          oracleText: '{T}: Destroy target nonland permanent.',
        },
      ],
    });
    const land = makeDef({
      scryfallId: 'cr115-ability-land-target',
      typeLine: 'Land',
      faces: [{ name: 'cr115-ability-land-target', typeLine: 'Land' }],
    });
    const artifact = makeDef({
      scryfallId: 'cr115-ability-artifact-target',
      typeLine: 'Artifact',
      faces: [{ name: 'cr115-ability-artifact-target', typeLine: 'Artifact' }],
    });

    store().newGame(
      [
        { def: source, isCommander: false },
        { def: land, isCommander: false },
        { def: artifact, isCommander: false },
      ],
      2,
    );
    const sourceId = findInstanceId('cr115-nonland-ability');
    const landId = findInstanceId('cr115-ability-land-target');
    const artifactId = findInstanceId('cr115-ability-artifact-target');
    moveToBattlefield(sourceId);
    moveToBattlefield(landId);
    moveToBattlefield(artifactId);

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided?.mode).toBe('activation');
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.destroy',
      kind: 'target',
      filter: { types: ['permanent'], excludedTypes: ['land'] },
    });

    store().confirmGuidedTarget(landId);
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(false);
    expect(store().pendingGuided).toBeNull();
    expect(store().warnings.at(-1)).toContain('対象が現在の候補にありません');

    store().activateAbility(sourceId, 0);
    store().confirmGuidedTarget(artifactId);
    expect(store().state!.zones.stack).toHaveLength(1);
    expect(store().state!.cards[sourceId].tapped).toBe(true);

    store().resolveTop();

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[artifactId].zone).toBe('graveyard');
  });

  it('excludes the source from another target activation choices before committing costs', () => {
    const source = makeDef({
      scryfallId: 'cr115-another-source',
      typeLine: 'Artifact Creature',
      faces: [
        {
          name: 'cr115-another-source',
          typeLine: 'Artifact Creature',
          oracleText: '{T}: Untap another target permanent you control.',
        },
      ],
    });
    const target = makeDef({
      scryfallId: 'cr115-another-target',
      typeLine: 'Artifact',
      faces: [{ name: 'cr115-another-target', typeLine: 'Artifact' }],
    });

    store().newGame(
      [
        { def: source, isCommander: false },
        { def: target, isCommander: false },
      ],
      3,
    );
    const sourceId = findInstanceId('cr115-another-source');
    const targetId = findInstanceId('cr115-another-target');
    moveToBattlefield(sourceId);
    moveToBattlefield(targetId);
    store().dispatch({ type: 'setTapped', cardId: targetId, tapped: true });

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided?.mode).toBe('activation');
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.untap',
      kind: 'target',
      filter: {
        types: ['permanent'],
        controller: 'you',
        excludeSource: true,
      },
    });

    store().confirmGuidedTarget(sourceId);
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(false);
    expect(store().pendingGuided).toBeNull();
    expect(store().warnings.at(-1)).toContain('対象が現在の候補にありません');

    store().activateAbility(sourceId, 0);
    store().confirmGuidedTarget(targetId);

    expect(store().state!.zones.stack).toHaveLength(1);
    expect(store().state!.cards[sourceId].tapped).toBe(true);

    store().resolveTop();

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[targetId].tapped).toBe(false);
    expect(store().state!.cards[sourceId].tapped).toBe(true);
  });

  it("excludes your permanents from spell targets that say you don't control", () => {
    const spell = makeDef({
      scryfallId: 'cr115-opponent-controlled-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr115-opponent-controlled-spell',
          typeLine: 'Sorcery',
          oracleText: "Destroy target artifact you don't control.",
        },
      ],
    });
    const ownArtifact = makeDef({
      scryfallId: 'cr115-own-artifact-target',
      typeLine: 'Artifact',
      faces: [{ name: 'cr115-own-artifact-target', typeLine: 'Artifact' }],
    });
    const opponentArtifact = makeDef({
      scryfallId: 'cr115-opponent-artifact-target',
      typeLine: 'Artifact',
      faces: [{ name: 'cr115-opponent-artifact-target', typeLine: 'Artifact' }],
    });

    store().newGame(
      [
        { def: spell, isCommander: false },
        { def: ownArtifact, isCommander: false },
        { def: opponentArtifact, isCommander: false },
      ],
      4,
    );
    const spellId = findInstanceId('cr115-opponent-controlled-spell');
    const ownArtifactId = findInstanceId('cr115-own-artifact-target');
    const opponentArtifactId = findInstanceId('cr115-opponent-artifact-target');
    store().moveCard(spellId, 'stack', 'bottom');
    moveToBattlefield(ownArtifactId);
    moveToBattlefield(opponentArtifactId);
    setController(opponentArtifactId, 'OPPONENT_A');

    store().resolveTop();

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.destroy',
      kind: 'target',
      filter: { types: ['artifact'], controller: 'opponent' },
    });

    store().confirmGuidedTarget(ownArtifactId);
    expect(store().state!.cards[ownArtifactId].zone).toBe('battlefield');
    expect(store().pendingGuided?.prompts[0].kind).toBe('target');
    expect(store().warnings.at(-1)).toContain('対象候補にありません');

    store().confirmGuidedTarget(opponentArtifactId);

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[opponentArtifactId].zone).toBe('graveyard');
    expect(store().state!.cards[ownArtifactId].zone).toBe('battlefield');
  });

  it("excludes your permanents from activation-time targets an opponent controls", () => {
    const source = makeDef({
      scryfallId: 'cr115-opponent-controlled-ability',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'cr115-opponent-controlled-ability',
          typeLine: 'Artifact',
          oracleText: '{T}: Tap target creature an opponent controls.',
        },
      ],
    });
    const ownCreature = makeDef({
      scryfallId: 'cr115-own-creature-target',
      typeLine: 'Creature',
      faces: [{ name: 'cr115-own-creature-target', typeLine: 'Creature' }],
    });
    const opponentCreature = makeDef({
      scryfallId: 'cr115-opponent-creature-target',
      typeLine: 'Creature',
      faces: [{ name: 'cr115-opponent-creature-target', typeLine: 'Creature' }],
    });

    store().newGame(
      [
        { def: source, isCommander: false },
        { def: ownCreature, isCommander: false },
        { def: opponentCreature, isCommander: false },
      ],
      5,
    );
    const sourceId = findInstanceId('cr115-opponent-controlled-ability');
    const ownCreatureId = findInstanceId('cr115-own-creature-target');
    const opponentCreatureId = findInstanceId('cr115-opponent-creature-target');
    moveToBattlefield(sourceId);
    moveToBattlefield(ownCreatureId);
    moveToBattlefield(opponentCreatureId);
    setController(opponentCreatureId, 'OPPONENT_A');

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided?.mode).toBe('activation');
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.tap',
      kind: 'target',
      filter: { types: ['creature'], controller: 'opponent' },
    });

    store().confirmGuidedTarget(ownCreatureId);
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(false);
    expect(store().pendingGuided).toBeNull();
    expect(store().warnings.at(-1)).toContain('対象が現在の候補にありません');

    store().activateAbility(sourceId, 0);
    store().confirmGuidedTarget(opponentCreatureId);

    expect(store().state!.zones.stack).toHaveLength(1);
    expect(store().state!.cards[sourceId].tapped).toBe(true);

    store().resolveTop();

    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[opponentCreatureId].tapped).toBe(true);
    expect(store().state!.cards[ownCreatureId].tapped).toBe(false);
  });
});
