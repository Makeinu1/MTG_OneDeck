import { describe, expect, it } from 'vitest';
import { activatedAbilityLines } from '../../engine/grammar';
import type { CardDef } from '../../types/card';
import { activatedAbilityDisplayText } from './abilityDisplay';
import { quickAbilityLabel } from './quickAbilityAction';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { buildCardActionCatalog } from './actionCatalog';

function manifoldKey(printedText?: string): CardDef {
  return {
    scryfallId: 'manifold-key',
    oracleId: 'manifold-key-oracle',
    name: 'Manifold Key',
    printedName: '多用途の鍵',
    lang: printedText ? 'ja' : 'en',
    layout: 'normal',
    cmc: 1,
    colorIdentity: [],
    typeLine: 'Artifact',
    faces: [{
      name: 'Manifold Key',
      printedName: '多用途の鍵',
      typeLine: 'Artifact',
      oracleText: '{1}, {T}: Untap another target artifact.\n{3}, {T}: Target creature can’t be blocked this turn.',
      ...(printedText ? { printedText } : {}),
    }],
  };
}

describe('activated ability display localization', () => {
  it('maps multiple Japanese paragraphs without changing their Oracle flat indexes', () => {
    const def = manifoldKey(
      '{1}, {T}：他のアーティファクト１つを対象とし、それをアンタップする。\n' +
      '{3}, {T}：クリーチャー１体を対象とする。このターン、それはブロックされない。',
    );
    const lines = activatedAbilityLines(def, 0);

    expect(lines.map((line) => line.index)).toEqual([0, 1]);
    expect(activatedAbilityDisplayText(def, lines[0])).toContain('アンタップする');
    expect(activatedAbilityDisplayText(def, lines[1])).toContain('ブロックされない');
    expect(quickAbilityLabel(lines[1], 'stack', 200, def)).toContain('[スタック]');
  });

  it('falls back to English when printed paragraphs cannot be mapped unambiguously', () => {
    const missing = manifoldKey();
    const mismatched = manifoldKey('{1}, {T}：日本語の段落が一つだけ。');
    expect(activatedAbilityDisplayText(missing, activatedAbilityLines(missing)[0])).toContain('Untap');
    expect(activatedAbilityDisplayText(mismatched, activatedAbilityLines(mismatched)[0])).toContain('Untap');
  });

  it('uses Japanese text for each multi-ability action while preserving action ids', () => {
    const state = buildVisualFixture('battlefield').snapshot.state;
    const cardId = state.zones.battlefield.find((id) => !state.cards[id].isAbility)!;
    const card = state.cards[cardId];
    const def = manifoldKey(
      '{1}, {T}：他のアーティファクト１つを対象とし、それをアンタップする。\n' +
      '{3}, {T}：クリーチャー１体を対象とする。このターン、それはブロックされない。',
    );
    const specs = buildCardActionCatalog({
      card: { ...card, defId: def.scryfallId, faceIndex: 0, zone: 'battlefield' },
      def,
      typeLine: def.typeLine,
      displayName: def.printedName ?? def.name,
      isCommanderCard: false,
      canAffordCast: true,
      landDropAvailable: true,
      commanderTax: 0,
    }).specs;

    expect(specs.find((spec) => spec.id === 'ability-activate-0')?.label).toContain('アンタップする');
    expect(specs.find((spec) => spec.id === 'ability-activate-1')?.label).toContain('ブロックされない');
  });
});
