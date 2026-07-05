// Reviewer-owned adversarial tests for cr-111-tokens: custom creature token leaf (`createDefinedToken`).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 110.5/110.5b: tapped/untapped は status。効果が明示すればデフォルト untapped を上書きできる。
// - CR 111.2: token の owner=それを作ったプレイヤー。token はそのプレイヤーの支配下で戦場に入る。
// - CR 111.3: 生成する spell/ability が token の特性を定義してよい(定義した値だけが copiable values)。
//   定義されなかった特性は token に存在しない=ability text 付き token を ability 抜きで生成しては
//   ならない(silent 劣化)。
// - CR 111.4: 名前未指定なら subtype(s)+"Token"。
// - CR 707(参考): copy token はこのスライス対象外(K0 完全defer)。既存 copyPermanent 無変更。
// 契約の要石 = 既存 pinned `createToken`(§32.8 predefined leaf)は無変更・新規 `createDefinedToken`
// のみ追加・スコープ外構文(ability text/variable count/copy/multicolor)は auto を騙らず manual に
// fail closed する。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import type { CardInstance, GameState } from '../types';
import { makeDeck } from './helpers';

function sourceDef(typeLine = 'Sorcery'): CardDef {
  return {
    scryfallId: 'r-cr111-src',
    oracleId: 'r-cr111-src',
    name: 'r-cr111-src',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine,
    faces: [{ name: 'r-cr111-src', typeLine }],
  };
}

function compile(line: string, typeLine = 'Sorcery') {
  return compileAbilityIR(parseAbilityIR(line, typeLine), {
    sourceId: 'source-1',
    def: sourceDef(typeLine),
  });
}

function battlefieldTokens(state: GameState): CardInstance[] {
  return state.zones.battlefield
    .map((id) => state.cards[id])
    .filter((card): card is CardInstance => Boolean(card?.isToken));
}

describe('cr-111-tokens: createDefinedToken custom creature token leaf (CR 110.5/111.2/111.3/111.4)', () => {
  it('Liliana golden: fixed untapped 2/2 Zombie token auto-compiles and lands untapped under P1', () => {
    const result = compile('Create a 2/2 black Zombie creature token.');
    expect(result.decision).toBe('auto');
    expect(result.commands).toEqual([
      {
        type: 'createDefinedToken',
        name: 'Zombie Token',
        typeLine: 'Token Creature — Zombie',
        power: '2',
        toughness: '2',
        quantity: 1,
        initialTapped: false,
      },
    ]);
    const state = applyCommand(initGame(makeDeck(5), 1), result.commands[0]).state;
    const tokens = battlefieldTokens(state);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tapped).toBe(false);
    expect(tokens[0].ownerId).toBe('P1');
    expect(tokens[0].controllerId).toBe('P1');
  });

  it('Tormod golden: fixed tapped 2/2 Zombie token auto-compiles and lands tapped (CR 110.5b override)', () => {
    const result = compile('Create a tapped 2/2 black Zombie creature token.');
    expect(result.decision).toBe('auto');
    expect(result.commands).toEqual([
      {
        type: 'createDefinedToken',
        name: 'Zombie Token',
        typeLine: 'Token Creature — Zombie',
        power: '2',
        toughness: '2',
        quantity: 1,
        initialTapped: true,
      },
    ]);
    const state = applyCommand(initGame(makeDeck(5), 1), result.commands[0]).state;
    expect(battlefieldTokens(state)[0].tapped).toBe(true);
  });

  it('rejects multicolor token text instead of emitting a corrupted auto result (Tier-1 HIGH fix)', () => {
    const result = compile('Create a 2/2 black and green Zombie creature token.');
    expect(result.decision).not.toBe('auto');
    expect(result.commands.some((c) => c.type === 'createDefinedToken')).toBe(false);
  });

  it('two-sentence tap-suppression is leaf-local: an unrelated Tap clause in the same ability still compiles guided', () => {
    const result = compile('Create a 2/2 black Zombie creature token. Tap target creature.');
    const tapPrompt = result.prompts.find((p) => p.atom === 'effect.tap');
    expect(tapPrompt).toBeDefined();
    expect(tapPrompt).toMatchObject({ atom: 'effect.tap', kind: 'target' });
  });

  it('keeps ability-text-bearing token creation manual (CR 111.3: undefined text must not be silently dropped)', () => {
    const result = compile('Create a 1/1 white Soldier creature token with "This creature can\'t block."');
    expect(result.decision).toBe('manual');
    expect(result.commands).toEqual([]);
  });

  it('keeps variable-count token creation manual', () => {
    const result = compile('Create X 1/1 white Soldier creature tokens.');
    expect(result.decision).toBe('manual');
    expect(result.commands).toEqual([]);
  });

  it('keeps copy token creation manual and does not touch copyPermanent or createDefinedToken', () => {
    const result = compile("Create a token that's a copy of target creature.");
    expect(result.decision).toBe('manual');
    expect(result.commands.some((c) => c.type === 'copyPermanent')).toBe(false);
    expect(result.commands.some((c) => c.type === 'createDefinedToken')).toBe(false);
  });

  it('non-regression: existing predefined Treasure leaf (§32.8) still uses createToken, not createDefinedToken', () => {
    const result = compile(
      "Whenever Ragavan, Nimble Pilferer deals combat damage to a player, create a Treasure token and exile the top card of that player's library.",
      'Creature',
    );
    expect(result.commands.some((c) => c.type === 'createToken' && c.tokenKind === 'treasure')).toBe(true);
    expect(result.commands.some((c) => c.type === 'createDefinedToken')).toBe(false);
  });

  it('CR 111.2: createdBy sets both owner and controller together for a non-P1 player', () => {
    const state = applyCommand(initGame(makeDeck(5), 1), {
      type: 'createDefinedToken',
      name: 'Soldier Token',
      typeLine: 'Token Creature — Soldier',
      power: '1',
      toughness: '1',
      quantity: 1,
      createdBy: 'OPPONENT_A',
    }).state;
    const token = battlefieldTokens(state)[0];
    expect(token.ownerId).toBe('OPPONENT_A');
    expect(token.controllerId).toBe('OPPONENT_A');
  });
});
