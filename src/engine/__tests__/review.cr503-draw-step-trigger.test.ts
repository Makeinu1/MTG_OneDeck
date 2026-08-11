import { beforeEach, describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { makeDeck, makeDef } from './helpers';
import type { GameState } from '../types';
import { useGameStore } from '../../store/gameStore';

function store() {
  return useGameStore.getState();
}

function snap(): GameState {
  const state = store().state;
  if (!state) throw new Error('game state is not available');
  return state;
}

function startGameWith(defs: CardDef[]): void {
  store().newGame(
    [...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(Math.max(0, 24 - defs.length))],
    1,
  );
  store().keepOpeningHand();
}

function findInstanceId(defId: string): string {
  const card = Object.values(snap().cards).find((instance) => instance.defId === defId);
  if (!card) throw new Error(`card instance not found for ${defId}`);
  return card.id;
}

function advanceToPhase(targetPhase: string): void {
  for (let i = 0; i < 16; i++) {
    const current = snap();
    if (current.phase === targetPhase) return;
    if (current.pendingTriggers.length > 0) {
      store().dismissTriggerCandidates();
    }
    store().nextPhase();
  }
}

function pendingFor(sourceId: string) {
  return snap().pendingTriggers.filter((t) => t.sourceId === sourceId);
}

const manaVaultDef = makeDef({
  scryfallId: 'mana-vault',
  typeLine: 'Artifact',
  faces: [{
    name: 'Mana Vault',
    typeLine: 'Artifact',
    oracleText: "Mana Vault doesn't untap during your untap step.\nAt the beginning of your upkeep, you may pay {4}. If you do, untap Mana Vault.\nAt the beginning of your draw step, if Mana Vault is tapped, it deals 1 damage to you.\n{T}: Add {C}{C}{C}.",
  }],
});

describe('CR 503: draw step phase-begin trigger (Mana Vault)', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      triggerCandidates: [],
      canUndo: false,
      canRedo: false,
      autoAdvanceToMain: false,
      mulliganDecisionPending: false,
    });
  });

  it('draw step trigger fires when Mana Vault is tapped', () => {
    startGameWith([manaVaultDef]);
    const vaultId = findInstanceId('mana-vault');

    store().moveCard(vaultId, 'battlefield');
    store().toggleTap(vaultId);
    expect(snap().cards[vaultId].tapped).toBe(true);

    advanceToPhase('draw');
    const triggers = pendingFor(vaultId);
    expect(triggers.some((t) => t.triggerId === 'trigger.draw-step')).toBe(true);
  });

  it('draw step trigger does NOT fire when Mana Vault is untapped (intervening-if)', () => {
    startGameWith([manaVaultDef]);
    const vaultId = findInstanceId('mana-vault');

    store().moveCard(vaultId, 'battlefield');
    // card is untapped by default after moveCard
    expect(snap().cards[vaultId].tapped).toBe(false);

    advanceToPhase('draw');
    const triggers = pendingFor(vaultId);
    expect(triggers.some((t) => t.triggerId === 'trigger.draw-step')).toBe(false);
  });

  it('upkeep trigger fires regardless of tapped state', () => {
    startGameWith([manaVaultDef]);
    const vaultId = findInstanceId('mana-vault');

    store().moveCard(vaultId, 'battlefield');
    // card is untapped by default after moveCard

    advanceToPhase('upkeep');
    const triggers = pendingFor(vaultId);
    expect(triggers.some((t) => t.triggerId === 'trigger.upkeep')).toBe(true);
  });
});
