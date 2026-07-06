// Reviewer-owned adversarial tests for cr-608-resolution Slice B (batch3-2b):
// resolution-time LKI reads for destroy+lose-life-equal-to-mana-value ("Feed the
// Swarm" shape). 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら
// 実装側を直す。
//
// CR grounding:
// - CR 608.2h: 対象が解決前に特性を変える(離ゾーン・値変更)場合、解決時に
//   参照する数値は「対象が選ばれた時点(＝last known information)」ではなく
//   効果が具体的に指定した基準に従う。本パターンは "its mana value" を
//   destroy 前の対象の特性として読む効果であり、実装は TargetSelection の
//   選択時snapshotから読む(現在のstate.cards再読ではない)——これが本スライスの
//   要石。
// - CR 400.7: オブジェクトが移動すると別オブジェクトになる。破壊後にmana valueを
//   再読すれば別オブジェクト(墓地のカード)の特性を読むことになり誤り。
// 契約の要石 = ObjectSnapshot.manaValue は additive(def.cmcから取得)。
// persistent GameState.resolutionContext は導入しない。新規GameCommand型も
// 追加しない(既存 moveCard + adjustLife の組み合わせ)。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand, objectSnapshotForCard } from '../commands';
import { buildGuidedCommands, compileAbilityIR, type EffectPrompt } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import type { GameState, TargetSelection, ZoneId } from '../types';
import { makeDef } from './helpers';

function cardDef(id: string, typeLine: string, cmc: number, oracleText?: string): CardDef {
  return makeDef({
    scryfallId: id,
    name: id,
    typeLine,
    cmc,
    faces: [{ name: id, typeLine, ...(oracleText ? { oracleText } : {}) }],
  });
}

function move(state: GameState, cardId: string, to: ZoneId): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to, position: 'bottom' }).state;
}

function compile(line: string, typeLine = 'Sorcery') {
  const source = cardDef('r-cr608b-compile-source', typeLine, 2, line);
  return compileAbilityIR(parseAbilityIR(line, typeLine), { sourceId: 'source-1', def: source });
}

function objectTargetSelection(state: GameState, prompt: EffectPrompt, cardId: string): TargetSelection {
  const snapshot = objectSnapshotForCard(state, cardId);
  if (!snapshot) {
    throw new Error(`missing snapshot for ${cardId}`);
  }
  return {
    slotId: 'target-0',
    raw: prompt.raw,
    kind: prompt.targetKind ?? 'object',
    selection: { kind: 'object', physicalCardId: snapshot.physicalCardId, objectId: snapshot.objectId, snapshot },
    legalityMode: 'checked',
  };
}

function stateWithDefCmc(state: GameState, defId: string, cmc: number): GameState {
  const def = state.defs[defId];
  if (!def) {
    throw new Error(`missing def ${defId}`);
  }
  return { ...state, defs: { ...state.defs, [defId]: { ...def, cmc } } };
}

describe('cr-608-resolution Slice B: resolution-time LKI for mana value (CR 608.2h/400.7)', () => {
  it('exact-phrase gate: wrong characteristic ("its power") does not compile to the mana-value leaf', () => {
    const result = compile('Destroy target creature. You lose life equal to its power.');
    expect(result.decision).not.toBe('guided');
    expect(result.prompts.some((p) => p.atom === 'effect.destroy')).toBe(false);
  });

  it('exact-phrase gate: wrong life-loser ("its controller loses life") does not compile to the mana-value leaf', () => {
    const result = compile('Destroy target creature. Its controller loses life equal to its mana value.');
    expect(result.decision).not.toBe('guided');
    expect(result.prompts.some((p) => p.atom === 'effect.destroy')).toBe(false);
  });

  it('plain destroy with no follow-up clause is byte-identical to pre-slice behavior (shared-plumbing non-regression)', () => {
    const result = compile('Destroy target creature.');
    const commands = buildGuidedCommands(
      result.prompts[0],
      { kind: 'target', cardIds: ['whatever'], targetSnapshots: [{ manaValue: 7 } as never] },
      { sourceId: 'source-1', def: cardDef('r-cr608b-src3', 'Sorcery', 2) },
    );
    expect(commands).toEqual([{ type: 'moveCard', cardId: 'whatever', to: 'graveyard', position: 'bottom' }]);
  });

  it('CR 608.2h: life loss uses the mana value captured at target-selection time, not a post-mutation re-read', () => {
    const abilityText =
      'When this creature enters, destroy target creature or planeswalker. You lose life equal to its mana value.';
    const source = cardDef('r-cr608b-lki-source', 'Creature — Cleric', 2, abilityText);
    const victim = cardDef('r-cr608b-lki-victim', 'Creature — Zombie', 4);
    let state = initGame([{ def: source, isCommander: false }, { def: victim, isCommander: false }], 1);
    state = move(state, 'c1', 'battlefield');
    state = move(state, 'c2', 'battlefield');

    const prompt = compile(abilityText, 'Creature — Cleric').prompts[0];
    const selection = objectTargetSelection(state, prompt, 'c2');
    expect(selection.selection.kind === 'object' && selection.selection.snapshot.manaValue).toBe(4);

    // Adversarial: mutate the victim's mana value AFTER selection, BEFORE resolution.
    // A buggy implementation that re-reads state.cards at resolve time would use 9.
    state = stateWithDefCmc(state, 'r-cr608b-lki-victim', 9);
    const sourceSnapshot = objectSnapshotForCard(state, 'c1');
    state = applyCommand(state, {
      type: 'addAbilityToStack',
      sourceId: 'c1',
      kind: 'triggered',
      abilityLineIndex: 0,
      sourceSnapshot: sourceSnapshot ?? undefined,
      targetSelections: [selection],
    }).state;

    const resolved = applyCommand(state, { type: 'resolveStackTop' }).state;
    expect(resolved.cards.c2.zone).toBe('graveyard');
    expect(resolved.life).toBe(36); // 40 - 4 (pre-mutation value), not 40 - 9.
  });

  it('zero-mana-value land target: adjustLife delta is exactly -0, not skipped (falsy-guard trap)', () => {
    const abilityText = 'When this creature enters, destroy target permanent. You lose life equal to its mana value.';
    const source = cardDef('r-cr608b-land-source', 'Creature — Cleric', 2, abilityText);
    const land = cardDef('r-cr608b-land', 'Land', 0);
    let state = initGame([{ def: source, isCommander: false }, { def: land, isCommander: false }], 1);
    state = move(state, 'c1', 'battlefield');
    state = move(state, 'c2', 'battlefield');

    const prompt = compile(abilityText, 'Creature — Cleric').prompts[0];
    const selection = objectTargetSelection(state, prompt, 'c2');
    const commands = buildGuidedCommands(
      prompt,
      {
        kind: 'target',
        cardIds: ['c2'],
        targetSnapshots: selection.selection.kind === 'object' ? [selection.selection.snapshot] : [],
      },
      { sourceId: 'c1', def: source },
    );
    // A naive `if (manaValue)` gate would wrongly omit the adjustLife command for 0.
    expect(commands).toEqual([
      { type: 'moveCard', cardId: 'c2', to: 'graveyard', position: 'bottom' },
      { type: 'adjustLife', delta: -0 },
    ]);

    const sourceSnapshot = objectSnapshotForCard(state, 'c1');
    state = applyCommand(state, {
      type: 'addAbilityToStack',
      sourceId: 'c1',
      kind: 'triggered',
      abilityLineIndex: 0,
      sourceSnapshot: sourceSnapshot ?? undefined,
      targetSelections: [selection],
    }).state;
    const resolved = applyCommand(state, { type: 'resolveStackTop' }).state;
    expect(resolved.cards.c2.zone).toBe('graveyard');
    expect(resolved.life).toBe(40);
  });

  it('missing snapshot degrades to no life-loss command rather than throwing (defensive-read contract)', () => {
    const result = compile('Destroy target creature or planeswalker. You lose life equal to its mana value.');
    const commands = buildGuidedCommands(
      result.prompts[0],
      { kind: 'target', cardIds: ['whatever'], targetSnapshots: [] },
      { sourceId: 'source-1', def: cardDef('r-cr608b-src4', 'Sorcery', 2) },
    );
    expect(commands).toEqual([{ type: 'moveCard', cardId: 'whatever', to: 'graveyard', position: 'bottom' }]);
  });

  it('guided plan for the new leaf still exposes a single effect.destroy target prompt (compile shape)', () => {
    const result = compile('Destroy target creature or planeswalker. You lose life equal to its mana value.');
    expect(result).toMatchObject({
      decision: 'guided',
      prompts: [{ atom: 'effect.destroy', kind: 'target', filter: { types: ['creature', 'planeswalker'] } }],
    });
  });
});
