// Reviewer-owned adversarial tests for cr-120-damage: source-backed, non-combat damage (`dealDamage`).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 120.1 / 120.2b: ダメージを与える主体は source。spell/ability が source を指定する。
// - CR 120.3a: infect を持たない source からプレイヤーへのダメージは life loss を生む。
// - CR 120.3c: プレースウォーカーへのダメージは忠誠カウンター除去(このスライスの対象外=境界)。
// - CR 120.3e / 704.5h: infect/wither なき source からクリーチャーへのダメージは marked damage のみ
//   (直接破壊しない・SBA が処理)。
// - CR 120.8: 0(以下)のダメージは「ダメージを与えない」= イベントも状態変更も一切なし。
// 契約の要石 = 既存 reviewer-pinned `markDamage`(source-less)は不変・combat 経路は不変・
// 新規 `dealDamage` は player/creature 排他かつ planeswalker は明示的に拒否(サイレント誤マーク禁止)。
import { describe, expect, it } from 'vitest';

import { applyCommand } from '../commands';
import { initGame } from '../init';
import type { DamageEvent, GameEvent, GameState, LifeChangeEvent } from '../types';
import { makeDeck, makeDef } from './helpers';

function creatureDef(id: string, power = '3', toughness = '3') {
  return makeDef({
    scryfallId: id,
    typeLine: 'Creature',
    faces: [{ name: id, typeLine: 'Creature', power, toughness }],
  });
}

function planeswalkerDef(id: string) {
  return makeDef({
    scryfallId: id,
    typeLine: 'Planeswalker',
    faces: [{ name: id, typeLine: 'Planeswalker', loyalty: '5' }],
  });
}

function instanceId(state: GameState, defId: string): string {
  const card = Object.values(state.cards).find((entry) => entry.defId === defId);
  if (!card) throw new Error(`missing instance for ${defId}`);
  return card.id;
}

function battlefieldState(defs: ReturnType<typeof creatureDef>[]): GameState {
  let state = initGame([...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(6)], 1);
  for (const def of defs) {
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: instanceId(state, def.scryfallId),
      to: 'battlefield',
      position: 'bottom',
    }).state;
  }
  return state;
}

function damageEvents(events: readonly GameEvent[]): DamageEvent[] {
  return events.filter((e): e is DamageEvent => e.type === 'damage');
}

function lifeChangeEvents(events: readonly GameEvent[]): LifeChangeEvent[] {
  return events.filter((e): e is LifeChangeEvent => e.type === 'lifeChange');
}

describe('cr-120-damage: dealDamage (CR 120.1/120.3a/120.3e/120.8)', () => {
  it('player damage: 1 DamageEvent linked to 1 LifeChangeEvent, life reduced by amount', () => {
    const source = creatureDef('r-cr120-p-src', '1', '1');
    let state = battlefieldState([source]);
    const sourceId = instanceId(state, source.scryfallId);
    const before = state.eventLog.length;

    state = applyCommand(state, {
      type: 'dealDamage',
      sourceId,
      targetPlayerId: 'OPPONENT_A',
      amount: 5,
      combatDamage: false,
    }).state;

    const events = state.eventLog.slice(before);
    const damage = damageEvents(events);
    const life = lifeChangeEvents(events);
    expect(state.opponentLife['対戦相手A']).toBe(35);
    expect(damage).toHaveLength(1);
    expect(life).toHaveLength(1);
    expect(damage[0].damageResultEventIds).toEqual([life[0].eventId]);
  });

  it('creature damage: marks damage via existing applyMarkDamage state, does not destroy directly (CR 704.5g SBA still applies separately)', () => {
    const source = creatureDef('r-cr120-c-src', '1', '1');
    const target = creatureDef('r-cr120-c-target', '3', '3');
    let state = battlefieldState([source, target]);
    const sourceId = instanceId(state, source.scryfallId);
    const targetId = instanceId(state, target.scryfallId);

    state = applyCommand(state, {
      type: 'dealDamage',
      sourceId,
      targetCardId: targetId,
      amount: 2,
      combatDamage: false,
    }).state;

    expect(state.cards[targetId].damageMarked).toBe(2);
    expect(state.cards[targetId].zone).toBe('battlefield');
  });

  it('CR 120.8: amount 0 emits no DamageEvent and mutates nothing', () => {
    const source = creatureDef('r-cr120-zero-src', '1', '1');
    const target = creatureDef('r-cr120-zero-target', '3', '3');
    const state = battlefieldState([source, target]);
    const sourceId = instanceId(state, source.scryfallId);
    const targetId = instanceId(state, target.scryfallId);

    const result = applyCommand(state, {
      type: 'dealDamage',
      sourceId,
      targetCardId: targetId,
      amount: 0,
      combatDamage: false,
    });

    expect(result.state).toEqual(state);
  });

  it('CR 120.8: negative amount is treated identically to zero (no damage)', () => {
    const source = creatureDef('r-cr120-neg-src', '1', '1');
    const target = creatureDef('r-cr120-neg-target', '3', '3');
    const state = battlefieldState([source, target]);
    const sourceId = instanceId(state, source.scryfallId);
    const targetId = instanceId(state, target.scryfallId);

    const result = applyCommand(state, {
      type: 'dealDamage',
      sourceId,
      targetCardId: targetId,
      amount: -5,
      combatDamage: false,
    });

    expect(result.state).toEqual(state);
  });

  it('rejects a malformed command with both targetCardId and targetPlayerId set (no silent fallback)', () => {
    const source = creatureDef('r-cr120-dual-src', '1', '1');
    const target = creatureDef('r-cr120-dual-target', '3', '3');
    const state = battlefieldState([source, target]);
    const sourceId = instanceId(state, source.scryfallId);
    const targetId = instanceId(state, target.scryfallId);

    // adversarial: both targets set to probe the runtime guard, not just the type system.
    const malformed = {
      type: 'dealDamage',
      sourceId,
      targetCardId: targetId,
      targetPlayerId: 'OPPONENT_A',
      amount: 3,
      combatDamage: false,
    } as unknown as Parameters<typeof applyCommand>[1];

    expect(() => applyCommand(state, malformed)).toThrow();
  });

  it('rejects a planeswalker target explicitly (CR 120.3c out of scope; must not silently mismark as creature damage)', () => {
    const source = creatureDef('r-cr120-pw-src', '1', '1');
    const pw = planeswalkerDef('r-cr120-pw-target');
    let state = initGame(
      [
        { def: source, isCommander: false },
        { def: pw, isCommander: false },
        ...makeDeck(6),
      ],
      1,
    );
    const sourceId = instanceId(state, source.scryfallId);
    const pwId = instanceId(state, pw.scryfallId);
    state = applyCommand(state, { type: 'moveCard', cardId: sourceId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: pwId, to: 'battlefield', position: 'bottom' }).state;

    expect(() =>
      applyCommand(state, {
        type: 'dealDamage',
        sourceId,
        targetCardId: pwId,
        amount: 3,
        combatDamage: false,
      }),
    ).toThrow();
  });

  it('legacy markDamage remains source-less and emits no DamageEvent (non-regression)', () => {
    const target = creatureDef('r-cr120-legacy-target', '3', '3');
    let state = battlefieldState([target]);
    const targetId = instanceId(state, target.scryfallId);
    const before = state.eventLog.length;

    state = applyCommand(state, { type: 'markDamage', cardId: targetId, amount: 2 }).state;

    expect(state.cards[targetId].damageMarked).toBe(2);
    expect(damageEvents(state.eventLog.slice(before))).toEqual([]);
  });
});
