// Reviewer-owned adversarial tests for cr-303-704-roles (Role token attachment & duplicate SBA).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 303.7: Some Aura enchantments also have the subtype "Role."
// - CR 303.7a / 704.5y: If a permanent has more than one Role controlled by the same
//   player attached to it, each of those Roles except the one with the most recent
//   timestamp is put into its owner's graveyard. This is a state-based action.
// - CR 111.10j–r: Seven predefined Role tokens (Cursed, Monster, Royal, Sorcerer,
//   Virtuous, Wicked, Young Hero).
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand, performStateBasedActions, type GameCommand } from '../commands';
import { initGame } from '../init';
import type { CardInstance, GameState } from '../types';
import { LOCAL_PLAYER_ID, DEFAULT_OPPONENT_ID } from '../types';
import { makeDeck, makeDef } from './helpers';

function creatureDef(id: string): CardDef {
  return makeDef({
    scryfallId: id,
    typeLine: 'Creature',
    faces: [{ name: id, typeLine: 'Creature', oracleText: '' }],
  });
}

function setupWithCreatures(count: number): { state: GameState; creatureIds: string[] } {
  const defs: CardDef[] = [];
  for (let i = 0; i < count; i++) {
    defs.push(creatureDef(`role-test-creature-${i}`));
  }
  const state = initGame([...defs.map((d) => ({ def: d, isCommander: false })), ...makeDeck(10)], 1);
  const creatureIds: string[] = [];
  let s = state;
  for (const def of defs) {
    const card = Object.values(s.cards).find((c) => c.defId === def.scryfallId);
    if (!card) throw new Error(`creature not found: ${def.scryfallId}`);
    const result = applyCommand(s, { type: 'moveCard', cardId: card.id, to: 'battlefield', position: 'bottom' });
    s = result.state;
    creatureIds.push(card.id);
  }
  return { state: s, creatureIds };
}

function createRoleToken(state: GameState, roleKind: string, targetCreatureId?: string): GameState {
  const cmd: GameCommand = {
    type: 'createToken',
    name: roleKind.replace(/-role$/, '').replace(/^\w/, (c) => c.toUpperCase()),
    typeLine: 'Enchantment Token — Aura Role',
    quantity: 1,
    tokenKind: roleKind as GameCommand extends { type: 'createToken'; tokenKind?: infer T } ? T : never,
    createdBy: LOCAL_PLAYER_ID,
  };
  let s = applyCommand(state, cmd).state;
  // Find the newly created Role token (the one not yet attached)
  const roleToken = Object.values(s.cards).find(
    (c) => c.isToken && c.zone === 'battlefield' && !c.attachedTo && s.defs[c.defId]?.typeLine.includes('Role'),
  );
  if (roleToken && targetCreatureId) {
    s = applyCommand(s, { type: 'attach', cardId: roleToken.id, to: targetCreatureId }).state;
  }
  return s;
}

function findRoleTokens(state: GameState): CardInstance[] {
  return Object.values(state.cards).filter(
    (c) => c.isToken && state.defs[c.defId]?.typeLine.includes('Role'),
  );
}

describe('CR 303.7 / 704.5y Role token SBA (engine level)', () => {
  it('A1: created Role token has correct def (typeLine contains Aura Role, tokenKind set)', () => {
    const { state, creatureIds } = setupWithCreatures(1);
    const s = createRoleToken(state, 'monster-role', creatureIds[0]);
    const roles = findRoleTokens(s);
    expect(roles.length).toBe(1);
    const role = roles[0];
    const def = s.defs[role.defId];
    expect(def).toBeDefined();
    expect(def.typeLine).toContain('Aura');
    expect(def.typeLine).toContain('Role');
    expect(def.tokenKind).toBe('monster-role');
    expect(role.attachedTo).toBe(creatureIds[0]);
  });

  it('A2: duplicate Role from same controller — older goes to graveyard via 704.5y', () => {
    const { state, creatureIds } = setupWithCreatures(1);
    const target = creatureIds[0];
    // Create first Role (Royal)
    let s = createRoleToken(state, 'royal-role', target);
    const firstRole = findRoleTokens(s).find((r) => r.zone === 'battlefield')!;
    expect(firstRole).toBeDefined();
    expect(firstRole.attachedTo).toBe(target);

    // Create second Role (Monster) on same creature.
    // SBA fires inside applyCommand(attach), so the duplicate is already resolved.
    s = createRoleToken(s, 'monster-role', target);

    // Only the newest Role remains attached
    const remaining = findRoleTokens(s).filter((r) => r.zone === 'battlefield');
    expect(remaining.length).toBe(1);
    expect(remaining[0].attachedTo).toBe(target);

    // The older Role token ceases to exist (704.5d cleans up tokens in graveyard).
    // Total Role tokens in state should be 1 (only the survivor).
    const allRoles = findRoleTokens(s);
    expect(allRoles.length).toBe(1);

    // Event log contains 704.5y reference
    const sbaEvent = s.eventLog.find(
      (e) => (e as { sbaApplied?: string }).sbaApplied === '704.5y',
    );
    expect(sbaEvent).toBeDefined();
  });

  it('A3: different controllers — no SBA fires', () => {
    const { state, creatureIds } = setupWithCreatures(1);
    const target = creatureIds[0];
    // Create Role controlled by P1
    let s = createRoleToken(state, 'cursed-role', target);
    // Create Role controlled by opponent
    const cmd: GameCommand = {
      type: 'createToken',
      name: 'Wicked',
      typeLine: 'Enchantment Token — Aura Role',
      quantity: 1,
      tokenKind: 'wicked-role' as never,
      createdBy: DEFAULT_OPPONENT_ID,
    };
    s = applyCommand(s, cmd).state;
    const oppRole = findRoleTokens(s).find((r) => r.controllerId === DEFAULT_OPPONENT_ID);
    expect(oppRole).toBeDefined();
    s = applyCommand(s, { type: 'attach', cardId: oppRole!.id, to: target }).state;

    const result = performStateBasedActions(s);
    s = result.state;

    // Both remain on battlefield
    const remaining = findRoleTokens(s).filter((r) => r.zone === 'battlefield');
    expect(remaining.length).toBe(2);
  });

  it('A4: same controller, different creatures — no SBA', () => {
    const { state, creatureIds } = setupWithCreatures(2);
    let s = createRoleToken(state, 'cursed-role', creatureIds[0]);
    s = createRoleToken(s, 'monster-role', creatureIds[1]);

    const result = performStateBasedActions(s);
    s = result.state;

    const remaining = findRoleTokens(s).filter((r) => r.zone === 'battlefield');
    expect(remaining.length).toBe(2);
  });

  it('A5: three Roles same controller same creature — keep newest only', () => {
    const { state, creatureIds } = setupWithCreatures(1);
    const target = creatureIds[0];
    let s = createRoleToken(state, 'cursed-role', target);
    s = createRoleToken(s, 'royal-role', target);
    s = createRoleToken(s, 'monster-role', target);

    const result = performStateBasedActions(s);
    s = result.state;

    const remaining = findRoleTokens(s).filter((r) => r.zone === 'battlefield');
    expect(remaining.length).toBe(1);
    expect(remaining[0].attachedTo).toBe(target);

    // Older Role tokens cease to exist (704.5d). Only the survivor remains in state.
    const allRoles = findRoleTokens(s);
    expect(allRoles.length).toBe(1);

    // Event log records two 704.5y removals
    const sbaEvents = s.eventLog.filter(
      (e) => (e as { sbaApplied?: string }).sbaApplied === '704.5y',
    );
    expect(sbaEvents.length).toBe(2);
  });

  it('A6: Role enters unattached when no creatures — no crash, no SBA', () => {
    const state = initGame(makeDeck(10), 1);
    const cmd: GameCommand = {
      type: 'createToken',
      name: 'Sorcerer',
      typeLine: 'Enchantment Token — Aura Role',
      quantity: 1,
      tokenKind: 'sorcerer-role' as never,
      createdBy: LOCAL_PLAYER_ID,
    };
    const s = applyCommand(state, cmd).state;
    const roles = findRoleTokens(s);
    expect(roles.length).toBe(1);
    expect(roles[0].attachedTo).toBeUndefined();

    const result = performStateBasedActions(s);
    // Role remains (unattached Roles are not affected by 704.5y)
    const remaining = findRoleTokens(result.state).filter((r) => r.zone === 'battlefield');
    expect(remaining.length).toBe(1);
  });
});
