import { describe, expect, it } from 'vitest';
import type { CardDef } from '../../types/card';
import { classifyCardRules, type RuleTag } from '../ruleClassifier';
import { summarizeDeckRuleTags } from '../ruleDeckSummary';

function makeCard(name: string, oracleText?: string, overrides: Partial<CardDef> = {}): CardDef {
  const base: CardDef = {
    scryfallId: `${name}-id`,
    oracleId: `${name}-oracle`,
    name,
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Creature',
    faces: [
      {
        name,
        typeLine: 'Creature',
        oracleText,
      },
    ],
  };

  return { ...base, ...overrides };
}

function tagIds(card: CardDef): string[] {
  return classifyCardRules(card).map((tag) => tag.id);
}

function tagById(card: CardDef, tagId: string): RuleTag | undefined {
  return classifyCardRules(card).find((tag) => tag.id === tagId);
}

describe('classifyCardRules', () => {
  it('does not treat Odric count operands as owned keywords', () => {
    const odric = makeCard(
      'Odric, Blood-Cursed',
      'When Odric enters, create X Blood tokens, where X is the number of abilities from among flying, first strike, double strike, deathtouch, haste, hexproof, indestructible, lifelink, menace, reach, trample, and vigilance found among creatures you control. (Count each ability only once.)',
      {
        keywords: [
          'Flying',
          'First Strike',
          'Double Strike',
          'Deathtouch',
          'Haste',
          'Hexproof',
          'Indestructible',
          'Lifelink',
          'Menace',
          'Reach',
          'Trample',
          'Vigilance',
        ],
      },
    );

    const ids = tagIds(odric);
    expect(ids.filter((id) => id.startsWith('keyword.'))).toEqual([]);
    expect(ids).toContain('trigger.etb');
    expect(ids).toContain('action.create-token');
  });

  it('detects a pure flying keyword line as owned', () => {
    expect(tagIds(makeCard('Ornithopter', 'Flying'))).toContain('keyword.flying');
  });

  it('detects cycling with a cost as owned', () => {
    expect(tagIds(makeCard('Cycling Bear', 'Cycling {2}'))).toContain('keyword.cycling');
  });

  it('does not treat granted anthem keywords as owned', () => {
    const anthem = makeCard(
      "Akroma's Memorial",
      'Creatures you control have flying, first strike, vigilance, trample, haste, and protection from black and from red.',
      { typeLine: 'Legendary Artifact' },
    );

    expect(tagIds(anthem).filter((id) => id.startsWith('keyword.'))).toEqual([]);
  });

  it('separates countering spells from putting counters on cards', () => {
    const counterspellIds = tagIds(makeCard('Counterspell', 'Counter target spell.'));
    expect(counterspellIds).toContain('action.counter');
    expect(counterspellIds).not.toContain('action.card-counters');

    const hardenedScalesIds = tagIds(
      makeCard(
        'Hardened Scales',
        'If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.',
        { typeLine: 'Enchantment' },
      ),
    );
    expect(hardenedScalesIds).toContain('action.card-counters');
    expect(hardenedScalesIds).toContain('effect.replacement');
    expect(hardenedScalesIds).not.toContain('action.counter');
  });

  it("does not classify can't be countered as a counter action", () => {
    expect(tagIds(makeCard('Abrupt Decay', "This spell can't be countered."))).not.toContain(
      'action.counter',
    );
  });

  it('detects safe action candidate tags from oracle text', () => {
    expect(tagIds(makeCard('Evolution Sage', 'Whenever a land enters, proliferate.'))).toContain(
      'action.proliferate',
    );
    expect(tagIds(makeCard('Mind Rot', 'Target player discards two cards.'))).toContain(
      'action.discard',
    );
    expect(
      tagIds(
        makeCard(
          'Evolving Wilds',
          'Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
        ),
      ),
    ).toContain('action.shuffle');
    expect(tagIds(makeCard('Dimir Informant', 'When this creature enters, surveil 2.'))).toContain(
      'action.surveil',
    );
  });

  it('detects target-requiring semi-automatic action tags', () => {
    expect(
      tagIds(
        makeCard(
          'Reanimate Spell',
          'Return target creature card from your graveyard to the battlefield.',
        ),
      ),
    ).toContain('action.return');
    expect(tagIds(makeCard('Exile Return', 'Return target card from exile to your hand.'))).toContain(
      'action.return',
    );
    expect(tagIds(makeCard('Attach Aura', 'Attach target Aura you control to target creature.'))).toContain(
      'action.attach',
    );
    expect(tagIds(makeCard('Short Sword', 'Equip {2}', { typeLine: 'Artifact — Equipment' }))).toContain(
      'action.attach',
    );
  });

  it('detects trigger-assist tags from oracle text', () => {
    expect(tagIds(makeCard('Blood Artist', 'Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life.'))).toContain(
      'trigger.death',
    );
    expect(tagIds(makeCard('Grave Pact', 'Whenever a creature is put into a graveyard from the battlefield, each other player sacrifices a creature.'))).toContain(
      'trigger.death',
    );
    expect(tagIds(makeCard('Eldrazi', 'When you cast this spell, draw two cards.'))).toContain(
      'trigger.cast',
    );
    expect(tagIds(makeCard('Raid Creature', 'Whenever Raid Creature attacks, create a token.'))).toContain(
      'trigger.attack',
    );
    expect(tagIds(makeCard('Landfall Beast', 'Landfall — Whenever a land enters under your control, put a +1/+1 counter on Landfall Beast.'))).toContain(
      'trigger.landfall',
    );
    expect(tagIds(makeCard('Upkeep Mage', 'At the beginning of your upkeep, draw a card.'))).toContain(
      'trigger.upkeep',
    );
  });

  it('detects watcher trigger-assist tags from oracle text', () => {
    const nivMizzet = makeCard(
      'Niv-Mizzet, Parun',
      'Whenever a player casts an instant or sorcery spell, you draw a card.',
    );
    const stormKilnArtist = makeCard(
      'Storm-Kiln Artist',
      'Magecraft — Whenever you cast or copy an instant or sorcery spell, create a Treasure token.',
    );
    const soulWarden = makeCard(
      'Soul Warden',
      'Whenever another creature enters the battlefield, you gain 1 life.',
    );
    const bloodArtist = makeCard(
      'Blood Artist',
      'Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life.',
    );
    const chainer = makeCard(
      'Chainer Attack Watcher',
      'Whenever one or more nontoken creatures attack, exile them at end of combat.',
    );
    const sunTitan = makeCard(
      'Sun Titan',
      'Whenever Sun Titan enters or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.',
      { typeLine: 'Creature — Giant' },
    );
    const selfDies = makeCard('Self Death', 'When Self Death dies, draw a card.');
    const vanilla = makeCard('Vanilla Bear');

    expect(tagIds(nivMizzet)).toContain('trigger.cast-watcher');
    expect(tagIds(stormKilnArtist)).toContain('trigger.cast-watcher');
    expect(tagIds(soulWarden)).toContain('trigger.etb-other');
    expect(tagIds(bloodArtist)).toContain('trigger.death-other');
    expect(tagIds(chainer)).toContain('trigger.attack-watcher');
    expect(tagIds(sunTitan)).not.toContain('trigger.etb-other');
    expect(tagIds(sunTitan)).not.toContain('trigger.attack-watcher');
    expect(tagIds(selfDies)).not.toContain('trigger.death-other');
    expect(tagIds(vanilla)).not.toContain('trigger.cast-watcher');
  });

  it('does not classify discard when the paragraph says it cannot happen', () => {
    expect(tagIds(makeCard('Library of Leng', "You can't discard cards."))).not.toContain(
      'action.discard',
    );
    expect(tagIds(makeCard('Curly Apostrophe', 'You can’t discard cards.'))).not.toContain(
      'action.discard',
    );
  });

  it('detects M6.8 zone-cast assist tags from oracle text', () => {
    const faithlessLooting = makeCard(
      'Faithless Looting',
      'Draw two cards, then discard two cards.\nFlashback {2}{R}',
      { typeLine: 'Sorcery' },
    );
    const uro = makeCard(
      'Uro, Titan of Nature’s Wrath',
      'Escape—{G}{G}{U}{U}, Exile five other cards from your graveyard.',
    );
    const muldrotha = makeCard(
      'Muldrotha, the Gravetide',
      'During each of your turns, you may play a land and cast a permanent spell of each permanent type from your graveyard.',
      { typeLine: 'Legendary Creature — Elemental Avatar' },
    );
    const fierceGuardianship = makeCard(
      'Fierce Guardianship',
      'If you control a commander, you may cast this spell without paying its mana cost.',
      { typeLine: 'Instant' },
    );
    const additionalCost = makeCard(
      'Additional Cost Spell',
      'As an additional cost to cast this spell, exile a creature card from your graveyard.',
      { typeLine: 'Sorcery' },
    );

    expect(tagIds(faithlessLooting)).toContain('concept.alt-cast');
    expect(tagById(faithlessLooting, 'concept.alt-cast')?.matchedText).toBe('Flashback');
    expect(tagIds(uro)).toContain('concept.alt-cast');
    expect(tagById(uro, 'concept.alt-cast')?.matchedText).toBe('Escape');
    expect(tagIds(muldrotha)).toContain('concept.cast-from-zone');
    expect(tagIds(fierceGuardianship)).toContain('cost.alternative');
    expect(tagIds(additionalCost)).toContain('cost.additional');
  });

  it('does not confuse reanimation or unrelated text with cast-from-zone assists', () => {
    const reanimate = makeCard(
      'Reanimate',
      'Put target creature card from a graveyard onto the battlefield under your control.',
      { typeLine: 'Sorcery' },
    );
    const animateDead = makeCard(
      'Animate Dead',
      'Return enchanted creature card to the battlefield under your control.',
      { typeLine: 'Enchantment — Aura' },
    );
    const sunTitan = makeCard(
      'Sun Titan',
      'Whenever Sun Titan enters or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.',
      { typeLine: 'Creature — Giant' },
    );
    const indestructible = makeCard('Indestructible Bear', "This creature can't be destroyed.");

    expect(tagIds(reanimate)).not.toContain('concept.cast-from-zone');
    expect(tagIds(animateDead)).not.toContain('concept.cast-from-zone');
    expect(tagIds(sunTitan)).not.toContain('concept.cast-from-zone');
    expect(tagIds(indestructible)).not.toContain('concept.alt-cast');
    expect(tagIds(indestructible)).not.toContain('cost.additional');
    expect(tagIds(indestructible)).not.toContain('cost.alternative');
  });

  it('is null-safe for missing runtime fields', () => {
    const malformed = {
      scryfallId: 'missing-id',
      oracleId: 'missing-oracle',
      name: 'Missing Oracle',
      lang: 'en',
      layout: 'normal',
      cmc: 0,
      colorIdentity: [],
      typeLine: 'Creature',
      keywords: ['Flying'],
    } as unknown as CardDef;

    expect(classifyCardRules(malformed)).toEqual([]);
  });

  it('is deterministic', () => {
    const card = makeCard('Mulldrifter', 'Flying\nWhen Mulldrifter enters, draw two cards.');

    expect(classifyCardRules(card)).toStrictEqual(classifyCardRules(card));
  });
});

describe('summarizeDeckRuleTags', () => {
  it('aggregates tags by deck quantity and preserves display names', () => {
    const summary = summarizeDeckRuleTags([
      {
        card: makeCard('Storm Crow', 'Flying', { printedName: '嵐雲のカラス' }),
        quantity: 2,
        section: 'main',
      },
      { card: makeCard('Ornithopter', 'Flying'), quantity: 1, section: 'main' },
      { card: makeCard('Counterspell', 'Counter target spell.'), quantity: 1, section: 'main' },
    ]);

    expect(summary[0]?.tag.id).toBe('keyword.flying');
    expect(summary[0]?.deckCount).toBe(3);
    expect(summary[0]?.cardNames).toEqual(['嵐雲のカラス', 'Ornithopter']);
  });
});
