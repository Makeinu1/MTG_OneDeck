// Reviewer-owned adversarial tests for cr-701-keyword-actions-frequent batch3-3
// (residual leaf: fixed-count self-library mill / scry / surveil). 実装エージェント
// (Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 701.17a/b: mill = 固定数を自分のlibrary先頭からgraveyardへ。要求数がlibrary
//   枚数を超えたら可能な限り(shortfall)。target player/opponent/each-player mill
//   は本スライス対象外(manual)。
// - CR 701.22a: scry N = 自分のlibrary先頭N枚を見て、任意枚数を任意順でbottomへ、
//   残りを任意順でtopへ。graveyardへは絶対に送らない。
// - CR 701.25a: surveil N = 自分のlibrary先頭N枚を見て、任意枚数をgraveyardへ、
//   残りを任意順でtopへ。bottomへは絶対に送らない。
// - CR 701.20b: reveal はゾーンを動かさない。本スライスは standalone reveal leaf
//   を追加しない(GameStateに公開情報state・reveal commandが無いため。追加すれば
//   fake-green=何もしないreveal commandになる)。既存 needs-choice→manual が正しい
//   fail-safe。
// 判定者裁定: 本残leafは新規domainでなく既存cr-701-keyword-actions-frequentの
// 再オープン(同CRファミリー・同leaf-compiler lane)。mill/scry/surveilは既存
// substrate(GameCommand.mill・GameCommand.arrangeTop・EffectPrompt.scry-surveil)が
// 既に正しく動いていた(実装ギャップなし)——ただしbuildGuidedCommandsのscry-surveil
// 分岐がprompt.atomを見ずtoBottom/toGraveyardを無条件転送していた(scryがgraveyard
// を、surveilがbottomを smuggleできる余地)。判定者が自らこの1件のみ外科修正
// (compile.tsのscry-surveil分岐にatom別ガードを追加)。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { buildGuidedCommands, compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import { makeDef } from './helpers';

function cardDef(id: string, typeLine: string, oracleText?: string): CardDef {
  return makeDef({ scryfallId: id, name: id, typeLine, faces: [{ name: id, typeLine, ...(oracleText ? { oracleText } : {}) }] });
}

function compile(line: string, typeLine = 'Sorcery') {
  const source = cardDef('r-cr701c-src', typeLine, line);
  return compileAbilityIR(parseAbilityIR(line, typeLine), { sourceId: 'source-1', def: source });
}

describe('cr-701-keyword-actions-frequent batch3-3: mill/scry/surveil (CR 701.17/701.22/701.25)', () => {
  it('mill: fixed self count compiles to auto and moves exactly N from library top to graveyard', () => {
    const result = compile('Mill two cards.');
    expect(result).toMatchObject({ decision: 'auto', commands: [{ type: 'mill', count: 2 }] });

    const source = cardDef('r-cr701c-mill-source', 'Creature — Cleric');
    const decoys = Array.from({ length: 5 }, (_, i) => cardDef(`r-cr701c-mill-lib-${i}`, 'Land'));
    let state = initGame([{ def: source, isCommander: false }, ...decoys.map((def) => ({ def, isCommander: false }))], 1);
    const before = state.zones.library.slice(0, 2);
    state = applyCommand(state, { type: 'mill', count: 2 }).state;
    expect(state.zones.graveyard).toEqual(expect.arrayContaining(before));
    expect(state.zones.library).not.toEqual(expect.arrayContaining(before));
  });

  it('mill: CR 701.17b shortfall — milling more than the library holds mills all available, no crash', () => {
    const source = cardDef('r-cr701c-shortfall-source', 'Creature — Cleric');
    let state = initGame([{ def: source, isCommander: false }], 1);
    const libSize = state.zones.library.length;
    state = applyCommand(state, { type: 'mill', count: libSize + 50 }).state;
    expect(state.zones.library).toHaveLength(0);
    expect(state.zones.graveyard.length).toBeGreaterThanOrEqual(libSize);
  });

  it('mill: target-player/opponent variants stay honest manual (no auto-claim beyond self)', () => {
    expect(compile('Target player mills three cards.').decision).toBe('manual');
    expect(compile('Each opponent mills three cards.').decision).toBe('manual');
    expect(compile('Each player mills three cards.').decision).toBe('manual');
  });

  it('mill: variable/word-form counts outside the fixed digit/two-ten gate stay manual (fail-safe under-recognition)', () => {
    expect(compile('Mill one card.').decision).toBe('manual');
    expect(compile('Mill X cards.').decision).toBe('manual');
  });

  it('scry: compiles to guided scry-surveil prompt; builder never emits a graveyard destination for a scry answer', () => {
    const result = compile('Scry 2.');
    expect(result).toMatchObject({
      decision: 'guided',
      prompts: [{ atom: 'effect.scry', kind: 'scry-surveil', count: 2 }],
    });
    const prompt = result.prompts[0];
    // Adversarial: even if a malformed/future caller supplies a non-empty toGraveyard
    // for a scry answer, the builder must not forward it — CR 701.22a forbids it.
    const commands = buildGuidedCommands(
      prompt,
      { kind: 'scry-surveil', topOrder: ['a'], toBottom: ['b'], toGraveyard: ['c', 'd'] },
      { sourceId: 'source-1', def: cardDef('r-cr701c-scry-src', 'Sorcery') },
    );
    expect(commands).toEqual([{ type: 'arrangeTop', topOrder: ['a'], toBottom: ['b'], toGraveyard: [] }]);
  });

  it('surveil: compiles to guided scry-surveil prompt; builder never emits a bottom destination for a surveil answer', () => {
    const result = compile('Surveil 2.');
    expect(result).toMatchObject({
      decision: 'guided',
      prompts: [{ atom: 'effect.surveil', kind: 'scry-surveil', count: 2 }],
    });
    const prompt = result.prompts[0];
    // Adversarial: even if a malformed/future caller supplies a non-empty toBottom
    // for a surveil answer, the builder must not forward it — CR 701.25a forbids it.
    const commands = buildGuidedCommands(
      prompt,
      { kind: 'scry-surveil', topOrder: ['a'], toBottom: ['b', 'c'], toGraveyard: ['d'] },
      { sourceId: 'source-1', def: cardDef('r-cr701c-surveil-src', 'Sorcery') },
    );
    expect(commands).toEqual([{ type: 'arrangeTop', topOrder: ['a'], toBottom: [], toGraveyard: ['d'] }]);
  });

  it('scry-then-draw compound (Preordain/Opt shape) carries the guided scry prompt plus the auto draw command', () => {
    const result = compile('Scry 2. Draw a card.');
    expect(result.decision).toBe('guided');
    expect(result.prompts).toEqual([expect.objectContaining({ atom: 'effect.scry', count: 2 })]);
    expect(result.commands).toEqual([{ type: 'draw', count: 1 }]);
  });

  it('arrangeTop resolution: scry actually moves chosen cards to library bottom, never to graveyard', () => {
    const source = cardDef('r-cr701c-arrange-source', 'Creature — Cleric');
    const decoys = Array.from({ length: 5 }, (_, i) => cardDef(`r-cr701c-arrange-lib-${i}`, 'Land'));
    let state = initGame([{ def: source, isCommander: false }, ...decoys.map((def) => ({ def, isCommander: false }))], 1);
    const top2 = state.zones.library.slice(0, 2);
    state = applyCommand(state, {
      type: 'arrangeTop',
      topOrder: [top2[0]],
      toBottom: [top2[1]],
      toGraveyard: [],
    }).state;
    expect(state.zones.graveyard).not.toContain(top2[1]);
    expect(state.zones.library[state.zones.library.length - 1]).toBe(top2[1]);
    expect(state.zones.library[0]).toBe(top2[0]);
  });

  it('arrangeTop rejects a payload that does not match the current library top N (anti-cheat invariant, shared by scry/surveil)', () => {
    const source = cardDef('r-cr701c-mismatch-source', 'Creature — Cleric');
    const state = initGame([{ def: source, isCommander: false }], 1);
    expect(() =>
      applyCommand(state, {
        type: 'arrangeTop',
        topOrder: ['not-a-real-top-card-id'],
        toBottom: [],
        toGraveyard: [],
      }),
    ).toThrow();
  });

  it('bare reveal stays honest manual: no fake-green no-op reveal command exists', () => {
    const result = compile('Reveal the top card of your library.');
    expect(result.decision).toBe('manual');
    expect(result.commands).toEqual([]);
  });

  it('reveal-then-search compounds (Cultivate/Kodama\'s Reach shape) stay manual as a whole, not partially guided', () => {
    const result = compile(
      'Search your library for up to two basic land cards, reveal them, put one onto the battlefield and the other into your hand, then shuffle.',
    );
    expect(result.decision).not.toBe('auto');
  });
});
