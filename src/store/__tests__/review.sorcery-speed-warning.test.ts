import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { CardDef } from '../../types/card';
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
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
}

function startGameWith(defs: CardDef[]): void {
  store().newGame(
    [...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(Math.max(0, 24 - defs.length))],
    1,
  );
  store().keepOpeningHand();
}

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find(
    (instance) => instance.defId === defId,
  );
  if (!card) throw new Error(`card instance not found for ${defId}`);
  return card.id;
}

const sorcerySpeedDef = makeDef({
  scryfallId: 'sorcery-speed-artifact',
  typeLine: 'Artifact',
  faces: [{
    name: 'Sorcery Speed Artifact',
    typeLine: 'Artifact',
    oracleText: '{T}: Draw a card. Activate only as a sorcery.',
  }],
});

const normalTapDef = makeDef({
  scryfallId: 'normal-tap-artifact',
  typeLine: 'Artifact',
  faces: [{
    name: 'Normal Tap Artifact',
    typeLine: 'Artifact',
    oracleText: '{T}: Draw a card.',
  }],
});

describe('Sorcery-speed activation warning (CR 602.5)', () => {
  beforeEach(resetStore);

  it('activating "as a sorcery" ability outside main phase is non-blocking (sandbox)', () => {
    startGameWith([sorcerySpeedDef]);
    const cardId = findInstanceId('sorcery-speed-artifact');
    store().moveCard(cardId, 'battlefield');

    const state = store().state!;
    expect(state.phase).not.toBe('main1');

    store().activateAbility(cardId, 0);
    // Non-blocking: ability goes on stack despite timing violation
    expect(store().state!.zones.stack.length).toBeGreaterThanOrEqual(1);
  });

  it('no warning when activating "as a sorcery" ability during main phase', () => {
    startGameWith([sorcerySpeedDef]);
    const cardId = findInstanceId('sorcery-speed-artifact');
    store().moveCard(cardId, 'battlefield');

    // Advance to main1
    store().nextPhase(); // untap -> upkeep
    store().dismissTriggerCandidates();
    store().nextPhase(); // upkeep -> draw
    store().dismissTriggerCandidates();
    store().nextPhase(); // draw -> main1

    const state = store().state!;
    expect(state.phase).toBe('main1');

    store().activateAbility(cardId, 0);
    expect(store().warnings.some((w) => w.includes('ソーサリーとしてのみ起動'))).toBe(false);
  });

  it('no warning for normal tap ability outside main phase', () => {
    startGameWith([normalTapDef]);
    const cardId = findInstanceId('normal-tap-artifact');
    store().moveCard(cardId, 'battlefield');

    store().activateAbility(cardId, 0);
    expect(store().warnings.some((w) => w.includes('ソーサリーとしてのみ起動'))).toBe(false);
  });
});
