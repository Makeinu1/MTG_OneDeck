// Reviewer-owned regression floor for the offline plan-card fixtures.
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// The plan fixtures claim to mirror live Scryfall data. The cold audit (2026-07-19)
// found two had drifted (Fear of Missing Out's type, Mystic Sanctuary's wording). These
// snapshots are the exact type_line / oracle_text returned by
//   https://api.scryfall.com/cards/named?exact=<name>
// on 2026-07-19. Pinning them stops silent fixture drift from making the reliability
// tests validate against fictional cards. If a real errata changes Scryfall, update the
// fixture AND this snapshot together (with a fresh API pull), never one alone.
import { describe, expect, it } from 'vitest';

import { PLAN_CARD_FIXTURES } from '../../test/fixtures/planCardFixtures';

const SCRYFALL_SNAPSHOT_2026_07_19 = {
  fearOfMissingOut: {
    typeLine: 'Enchantment Creature — Nightmare',
    oracleText:
      'When this creature enters, discard a card, then draw a card.\n'
      + 'Delirium — Whenever this creature attacks for the first time each turn, if there are '
      + 'four or more card types among cards in your graveyard, untap target creature. After '
      + 'this phase, there is an additional combat phase.',
  },
  mysticSanctuary: {
    typeLine: 'Land — Island',
    oracleText:
      '({T}: Add {U}.)\n'
      + 'This land enters tapped unless you control three or more other Islands.\n'
      + 'When this land enters untapped, you may put target instant or sorcery card from your '
      + 'graveyard on top of your library.',
  },
  gogo: {
    typeLine: 'Legendary Creature — Wizard',
    oracleText:
      "{X}{X}, {T}: Copy target activated or triggered ability you control X times. You may "
      + "choose new targets for the copies. This ability can't be copied and X can't be 0. "
      + "(Mana abilities can't be targeted.)",
  },
  mishrasBauble: {
    typeLine: 'Artifact',
    oracleText:
      "{T}, Sacrifice this artifact: Look at the top card of target player's library. Draw a "
      + "card at the beginning of the next turn's upkeep.",
  },
} as const;

describe('plan-card fixtures match the pinned Scryfall snapshot (2026-07-19)', () => {
  for (const key of Object.keys(SCRYFALL_SNAPSHOT_2026_07_19) as (keyof typeof SCRYFALL_SNAPSHOT_2026_07_19)[]) {
    it(`${key} type_line and oracle_text match Scryfall`, () => {
      const fixture = PLAN_CARD_FIXTURES[key];
      const expected = SCRYFALL_SNAPSHOT_2026_07_19[key];
      expect(fixture.typeLine).toBe(expected.typeLine);
      expect(fixture.faces[0]?.typeLine).toBe(expected.typeLine);
      expect(fixture.faces[0]?.oracleText).toBe(expected.oracleText);
    });
  }
});
