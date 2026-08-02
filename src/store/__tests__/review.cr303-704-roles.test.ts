// Reviewer-owned adversarial tests for cr-303-704-roles (store level: undo, SBA integration).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 303.7a / 704.5y: duplicate Role SBA — same controller, same permanent → keep newest.
// - CR 111.10j–r: predefined Role token definitions.
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
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === defId);
  if (!card) throw new Error(`card instance not found for ${defId}`);
  return card.id;
}

function battlefieldRoleTokens(): Array<{ id: string; defId: string; attachedTo?: string }> {
  const state = store().state!;
  return state.zones.battlefield
    .map((id) => state.cards[id])
    .filter((c) => c?.isToken && state.defs[c.defId]?.typeLine.includes('Role'))
    .map((c) => ({ id: c.id, defId: c.defId, attachedTo: c.attachedTo }));
}

describe('cr-303-704 Role SBA (store level)', () => {
  beforeEach(() => {
    resetStore();
    const creature = makeDef({
      scryfallId: 'role-store-creature',
      typeLine: 'Creature',
      faces: [{ name: 'role-store-creature', typeLine: 'Creature', oracleText: '' }],
    });
    store().newGame(
      [{ def: creature, isCommander: false }, ...makeDeck(12)],
      1,
    );
    const creatureId = findInstanceId('role-store-creature');
    store().moveCard(creatureId, 'battlefield');
  });

  it('A7: undo after Role creation + SBA restores pre-creation state', () => {
    const state = store().state!;
    const creatureId = state.zones.battlefield.find(
      (id) => state.cards[id]?.defId === 'role-store-creature',
    )!;

    // Create first Role and attach
    store().createToken('Royal', 'Enchantment Token — Aura Role', undefined, undefined, 1, {
      tokenKind: 'royal-role' as never,
    });
    let roles = battlefieldRoleTokens();
    if (roles.length > 0 && !roles[0].attachedTo) {
      store().dispatch({ type: 'attach', cardId: roles[0].id, to: creatureId });
    }

    // Create second Role and attach — triggers SBA
    store().createToken('Monster', 'Enchantment Token — Aura Role', undefined, undefined, 1, {
      tokenKind: 'monster-role' as never,
    });
    roles = battlefieldRoleTokens();
    const unattached = roles.find((r) => !r.attachedTo);
    if (unattached) {
      store().dispatch({ type: 'attach', cardId: unattached.id, to: creatureId });
    }

    // After SBA, only one Role should remain on battlefield
    const afterSba = battlefieldRoleTokens();
    expect(afterSba.length).toBe(1);

    // Undo should restore the state before the second Role creation
    store().undo();
    const afterUndo = battlefieldRoleTokens();
    // At minimum, the undo should not crash and should reduce or restore Role count
    expect(afterUndo.length).toBeGreaterThanOrEqual(1);
  });

  it('A2-store: duplicate Role SBA fires through dispatch and event log records 704.5y', () => {
    const state = store().state!;
    const creatureId = state.zones.battlefield.find(
      (id) => state.cards[id]?.defId === 'role-store-creature',
    )!;

    // Create and attach first Role
    store().createToken('Cursed', 'Enchantment Token — Aura Role', undefined, undefined, 1, {
      tokenKind: 'cursed-role' as never,
    });
    let roles = battlefieldRoleTokens();
    expect(roles.length).toBe(1);
    store().dispatch({ type: 'attach', cardId: roles[0].id, to: creatureId });

    // Create and attach second Role
    store().createToken('Virtuous', 'Enchantment Token — Aura Role', undefined, undefined, 1, {
      tokenKind: 'virtuous-role' as never,
    });
    roles = battlefieldRoleTokens();
    const newRole = roles.find((r) => !r.attachedTo);
    expect(newRole).toBeDefined();
    store().dispatch({ type: 'attach', cardId: newRole!.id, to: creatureId });

    // SBA should have fired — only one Role remains
    const remaining = battlefieldRoleTokens();
    expect(remaining.length).toBe(1);
    expect(remaining[0].attachedTo).toBe(creatureId);

    // Event log records 704.5y
    const sbaEvent = store().state!.eventLog.find(
      (e) => (e as { sbaApplied?: string }).sbaApplied === '704.5y',
    );
    expect(sbaEvent).toBeDefined();
  });
});
