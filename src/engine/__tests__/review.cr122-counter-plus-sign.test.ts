// Reviewer-owned adversarial tests for cr-122-counters batch3-4 (counter-plus sign fix).
// 実装エージェント(Codex含む)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 122.1a: a +X/+Y counter and a -X/-Y counter are DISTINCT kinds (sign is part of the
//   counter's identity, not a separate delta on one shared kind).
// - CR 122.3/704.5c/704.5q: a permanent with both +1/+1 and -1/-1 counters loses N of each as
//   a state-based action, N = min(count).
// 判定者が自ら発見・修正したバグ: `effect.counter-plus` の既存guided leafは、oracle文の
// 符号(+1/+1 vs -1/-1)を一切見ず、常に `counterType:'+1/+1'` をハードコードして
// いた。つまり「Put a -1/-1 counter on target creature.」のようなカードはguidedとして
// 提示された上で、確定時に**逆符号の+1/+1カウンターを置いてしまう**という、サイレントな
// 誤動作(honest manualへのfail-safeではなく、fake-greenより悪い「常に間違った動作を
// 自信満々に実行する」バグ)だった。既存カード例: Grim Affliction / Corpse Cur 等の
// -1/-1 counter付与カードが影響対象。
// 修正: `counterDescriptorForRaw`(compile.ts)が符号込みでdescriptorを解析し、
// `guidedTargetPrompt`が解析不能な記述(可変X等)は最初からguidedを提示しない
// (fail closed to manual)よう事前ゲートを追加。`buildGuidedCommands`は解析済み
// descriptorのcounterType/deltaをそのまま使う(ハードコードを撤去)。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand, performStateBasedActions } from '../commands';
import { buildGuidedCommands, compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import { makeDef } from './helpers';

function cardDef(id: string, typeLine: string, oracleText?: string): CardDef {
  return makeDef({ scryfallId: id, name: id, typeLine, faces: [{ name: id, typeLine, ...(oracleText ? { oracleText } : {}) }] });
}

function compile(line: string, typeLine = 'Sorcery') {
  const source = cardDef('r-cr122-src', typeLine, line);
  return compileAbilityIR(parseAbilityIR(line, typeLine), { sourceId: 'source-1', def: source });
}

describe('cr-122-counters: counter-plus sign fix (CR 122.1a/122.3/704.5q)', () => {
  it('HIGH fix pin: "-1/-1 counter" resolves to a -1/-1 counter, not the hardcoded +1/+1 (the bug)', () => {
    const result = compile('Put a -1/-1 counter on target creature.');
    expect(result.decision).toBe('guided');
    const commands = buildGuidedCommands(
      result.prompts[0],
      { kind: 'target', cardIds: ['victim'] },
      { sourceId: 'source-1', def: cardDef('r-cr122-minus-src', 'Sorcery') },
    );
    expect(commands).toEqual([{ type: 'addCounters', cardId: 'victim', counterType: '-1/-1', delta: 1 }]);
  });

  it('"+1/+1 counter" (unaffected control) still resolves to +1/+1 (non-regression)', () => {
    const result = compile('Put a +1/+1 counter on target creature.');
    const commands = buildGuidedCommands(
      result.prompts[0],
      { kind: 'target', cardIds: ['victim'] },
      { sourceId: 'source-1', def: cardDef('r-cr122-plus-src', 'Sorcery') },
    );
    expect(commands).toEqual([{ type: 'addCounters', cardId: 'victim', counterType: '+1/+1', delta: 1 }]);
  });

  it('fixed-count -1/-1 (digit and word forms) parses the correct magnitude, not just the sign', () => {
    const digitResult = compile('Put 3 -1/-1 counters on target creature.');
    const digitCommands = buildGuidedCommands(
      digitResult.prompts[0],
      { kind: 'target', cardIds: ['victim'] },
      { sourceId: 'source-1', def: cardDef('r-cr122-digit-src', 'Sorcery') },
    );
    expect(digitCommands).toEqual([{ type: 'addCounters', cardId: 'victim', counterType: '-1/-1', delta: 3 }]);

    const wordResult = compile('Put two -1/-1 counters on target creature.');
    const wordCommands = buildGuidedCommands(
      wordResult.prompts[0],
      { kind: 'target', cardIds: ['victim'] },
      { sourceId: 'source-1', def: cardDef('r-cr122-word-src', 'Sorcery') },
    );
    expect(wordCommands).toEqual([{ type: 'addCounters', cardId: 'victim', counterType: '-1/-1', delta: 2 }]);
  });

  it('exact-phrase gate: variable/X count on either sign fails closed to manual (no guessed magnitude)', () => {
    expect(compile('Put X -1/-1 counters on target creature.').decision).toBe('manual');
    expect(compile('Put X +1/+1 counters on target creature.').decision).toBe('manual');
  });

  it('CR 122.3/704.5q: a guided -1/-1 placement onto a permanent that already has +1/+1 counters correctly triggers annihilation SBA', () => {
    const victimDef = cardDef('r-cr122-annihilation-victim', 'Creature — Bear');
    let state = initGame([{ def: victimDef, isCommander: false }], 1);
    const victimId = Object.values(state.cards).find((c) => c.defId === 'r-cr122-annihilation-victim')!.id;
    state = applyCommand(state, { type: 'moveCard', cardId: victimId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'addCounters', cardId: victimId, counterType: '+1/+1', delta: 2 }).state;

    const result = compile('Put a -1/-1 counter on target creature.');
    const commands = buildGuidedCommands(
      result.prompts[0],
      { kind: 'target', cardIds: [victimId] },
      { sourceId: 'source-1', def: cardDef('r-cr122-annihilation-src', 'Sorcery') },
    );
    for (const command of commands) {
      state = applyCommand(state, command).state;
    }
    // applyCommand already settles SBAs (CR 704.5q) before returning: min(2,1)=1 pair
    // removed → 1 +1/+1 remains, -1/-1 fully annihilated. If the fix had left the
    // hardcoded '+1/+1' bug in place, this guided "-1/-1" card would have instead added
    // a THIRD +1/+1 counter (3 total, no annihilation), so this pin also transitively
    // guards the sign fix from this file's other angle.
    expect(state.cards[victimId].counters).toEqual({ '+1/+1': 1 });
    expect(performStateBasedActions(state).state.cards[victimId].counters).toEqual({ '+1/+1': 1 });
  });
});
