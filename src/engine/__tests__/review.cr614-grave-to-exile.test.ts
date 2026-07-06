// Reviewer-owned adversarial tests for cr-614-615-616 Slice B: graveyard→exile
// 置換hook(design-lock: docs/engine-spec.md §34.35・Fable裁定)。実装エージェント
// (Codex含む)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 614.1a: "instead"を使う効果=replacement effect。
// - CR 614.5: replacement effectは同一eventへ1回のみ適用(行き先を移動前に1回
//   計算する方式=再帰なし)。
// - CR 614.6: 置換されたeventは発生しない。dies(CR700.4=battlefield→graveyard)は
//   行き先がexileになった時点で正しく発火しなくなる。
// - CR 404.1: カードは常にownerの墓地へ行く=「your graveyard」判定はmoving cardの
//   owner==sourceのcontroller。
// 契約の要石=moveCardInternal冒頭の単一フック(全graveyard経路が経由することを
// grep検証済み=mill/discard/surveil/sacrifice/destroy/SBA死亡で取りこぼしゼロ)。
// 置換ソース不在時は純粋pass-through(byte-identical)。
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { initGame, type InitDeckCard } from '../init';
import type { GameState, ZoneChangeEvent } from '../types';
import { makeDeck, makeDef } from './helpers';

function cardDef(id: string, typeLine: string, oracleText?: string): CardDef {
  return makeDef({ scryfallId: id, name: id, typeLine, faces: [{ name: id, typeLine, ...(oracleText ? { oracleText } : {}) }] });
}

const HADES_TEXT =
  'Vigilance\nEcho of the Lost — During your turn, you may play cards from your graveyard.\nIf a card or token would be put into your graveyard from anywhere, exile it instead.';

function gameWith(defs: CardDef[]): GameState {
  const deck: InitDeckCard[] = [...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(20)];
  return initGame(deck, 1);
}

function idOf(state: GameState, defId: string): string {
  return Object.values(state.cards).find((card) => card.defId === defId)?.id ?? '';
}

function lastZoneChangeFor(state: GameState, physicalCardId: string): ZoneChangeEvent | undefined {
  return state.eventLog
    .filter((e): e is ZoneChangeEvent => e.type === 'zoneChange' && e.before?.physicalCardId === physicalCardId)
    .at(-1);
}

describe('cr-614-615-616 Slice B: graveyard→exile replacement hook (CR 614.1a/614.5/614.6)', () => {
  it('golden (Hades shape): discard is redirected to exile with the replacementApplied marker, reason preserved', () => {
    const source = cardDef('r-g2e-hades', 'Legendary Creature — God', HADES_TEXT);
    const fodder = cardDef('r-g2e-fodder', 'Creature — Bear');
    let state = gameWith([source, fodder]);
    const srcId = idOf(state, 'r-g2e-hades');
    const fodId = idOf(state, 'r-g2e-fodder');
    state = applyCommand(state, { type: 'moveCard', cardId: srcId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'hand', position: 'bottom' }).state;

    state = applyCommand(state, { type: 'discard', cardIds: [fodId] }).state;
    expect(state.cards[fodId].zone).toBe('exile');
    const event = lastZoneChangeFor(state, fodId);
    expect(event?.toZone).toBe('exile');
    expect(event?.reason).toBe('discard');
    expect(event?.replacementApplied).toBe('614.6:grave-to-exile');
  });

  it('pass-through: without the source on the battlefield, discard goes to the graveyard as before', () => {
    const fodder = cardDef('r-g2e-plain-fodder', 'Creature — Bear');
    let state = gameWith([fodder]);
    const fodId = idOf(state, 'r-g2e-plain-fodder');
    state = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'hand', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'discard', cardIds: [fodId] }).state;
    expect(state.cards[fodId].zone).toBe('graveyard');
    expect(lastZoneChangeFor(state, fodId)?.replacementApplied).toBeUndefined();
  });

  it('mill path: milled cards are redirected to exile while the source is on the battlefield', () => {
    const source = cardDef('r-g2e-mill-src', 'Enchantment', 'If a card or token would be put into your graveyard from anywhere, exile it instead.');
    let state = gameWith([source]);
    const srcId = idOf(state, 'r-g2e-mill-src');
    state = applyCommand(state, { type: 'moveCard', cardId: srcId, to: 'battlefield', position: 'bottom' }).state;

    const top = state.zones.library[0];
    state = applyCommand(state, { type: 'mill', count: 1 }).state;
    expect(state.cards[top].zone).toBe('exile');
    expect(state.zones.graveyard).not.toContain(top);
  });

  it('CR 614.6: a creature whose destruction is replaced does NOT die — dies-trigger must not fire', () => {
    const source = cardDef('r-g2e-dies-src', 'Enchantment', 'If a card or token would be put into your graveyard from anywhere, exile it instead.');
    const watcher = cardDef('r-g2e-dies-watcher', 'Enchantment', 'Whenever a creature dies, draw a card.');
    const victim = cardDef('r-g2e-dies-victim', 'Creature — Bear');
    let state = gameWith([source, watcher, victim]);
    const srcId = idOf(state, 'r-g2e-dies-src');
    const watId = idOf(state, 'r-g2e-dies-watcher');
    const vicId = idOf(state, 'r-g2e-dies-victim');
    state = applyCommand(state, { type: 'moveCard', cardId: srcId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: watId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: vicId, to: 'battlefield', position: 'bottom' }).state;

    const pendingBefore = state.pendingTriggers.filter((t) => t.sourceId === watId).length;
    state = applyCommand(state, { type: 'moveCard', cardId: vicId, to: 'graveyard', position: 'bottom' }).state;
    expect(state.cards[vicId].zone).toBe('exile');
    expect(state.pendingTriggers.filter((t) => t.sourceId === watId)).toHaveLength(pendingBefore);
  });

  it('self-application: the source itself is exiled instead of dying (no self-exclusion)', () => {
    const source = cardDef('r-g2e-self', 'Legendary Creature — God', HADES_TEXT);
    let state = gameWith([source]);
    const srcId = idOf(state, 'r-g2e-self');
    state = applyCommand(state, { type: 'moveCard', cardId: srcId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: srcId, to: 'graveyard', position: 'bottom' }).state;
    expect(state.cards[srcId].zone).toBe('exile');
  });

  it('deactivation: once the source has left the battlefield, graveyard moves are normal again', () => {
    const source = cardDef('r-g2e-deact', 'Enchantment', 'If a card or token would be put into your graveyard from anywhere, exile it instead.');
    const fodder = cardDef('r-g2e-deact-fodder', 'Creature — Bear');
    let state = gameWith([source, fodder]);
    const srcId = idOf(state, 'r-g2e-deact');
    const fodId = idOf(state, 'r-g2e-deact-fodder');
    state = applyCommand(state, { type: 'moveCard', cardId: srcId, to: 'battlefield', position: 'bottom' }).state;
    // Source leaves (itself exiled by its own replacement — also fine via direct exile).
    state = applyCommand(state, { type: 'moveCard', cardId: srcId, to: 'exile', position: 'bottom' }).state;

    state = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'graveyard', position: 'bottom' }).state;
    expect(state.cards[fodId].zone).toBe('graveyard');
  });

  it('face gate: the untransformed front face (Emet-Selch, Unsundered) does NOT activate the replacement', () => {
    const dfc = makeDef({
      scryfallId: 'r-g2e-dfc',
      name: 'r-g2e-dfc',
      typeLine: 'Legendary Creature — Human Wizard',
      faces: [
        {
          name: 'Emet-Selch, Unsundered',
          typeLine: 'Legendary Creature — Human Wizard',
          oracleText:
            'Vigilance\nWhenever Emet-Selch enters or attacks, draw a card, then discard a card.\nAt the beginning of your upkeep, if there are fourteen or more cards in your graveyard, you may transform Emet-Selch.',
        },
        {
          name: 'Hades, Sorcerer of Eld',
          typeLine: 'Legendary Creature — God',
          oracleText: HADES_TEXT,
        },
      ],
    });
    const fodder = cardDef('r-g2e-dfc-fodder', 'Creature — Bear');
    let state = gameWith([dfc, fodder]);
    const dfcId = idOf(state, 'r-g2e-dfc');
    const fodId = idOf(state, 'r-g2e-dfc-fodder');
    state = applyCommand(state, { type: 'moveCard', cardId: dfcId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'battlefield', position: 'bottom' }).state;

    // Front face (faceIndex 0): replacement inactive.
    state = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'graveyard', position: 'bottom' }).state;
    expect(state.cards[fodId].zone).toBe('graveyard');

    // Transform to Hades (faceIndex 1): replacement active.
    state = applyCommand(state, { type: 'setFace', cardId: dfcId, faceIndex: 1 }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'graveyard', position: 'bottom' }).state;
    expect(state.cards[fodId].zone).toBe('exile');
  });

  it('"a card" variant (Yawgmoth\'s Agenda shape, no "or token") also matches the gate', () => {
    const source = cardDef('r-g2e-agenda', 'Enchantment', 'If a card would be put into your graveyard from anywhere, exile it instead.');
    const fodder = cardDef('r-g2e-agenda-fodder', 'Creature — Bear');
    let state = gameWith([source, fodder]);
    const srcId = idOf(state, 'r-g2e-agenda');
    const fodId = idOf(state, 'r-g2e-agenda-fodder');
    state = applyCommand(state, { type: 'moveCard', cardId: srcId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'graveyard', position: 'bottom' }).state;
    expect(state.cards[fodId].zone).toBe('exile');
  });

  it('false-positive guard: the single-spell self-replacement variant ("If that spell would be put into your graveyard") does not activate the global hook', () => {
    const source = cardDef(
      'r-g2e-narrow',
      'Legendary Creature — Wizard',
      'Whenever one or more opponents lose life, you may cast target instant or sorcery card from your graveyard. If that spell would be put into your graveyard, exile it instead.',
    );
    const fodder = cardDef('r-g2e-narrow-fodder', 'Creature — Bear');
    let state = gameWith([source, fodder]);
    const srcId = idOf(state, 'r-g2e-narrow');
    const fodId = idOf(state, 'r-g2e-narrow-fodder');
    state = applyCommand(state, { type: 'moveCard', cardId: srcId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: fodId, to: 'graveyard', position: 'bottom' }).state;
    expect(state.cards[fodId].zone).toBe('graveyard');
  });

  it('Tier-1 fix pin: a COMMANDER moving to the graveyard is exempt from the hook (the store\'s CR 903.9a zone-choice prompt must keep seeing the graveyard event)', () => {
    const source = cardDef('r-g2e-cmdr-src', 'Enchantment', 'If a card or token would be put into your graveyard from anywhere, exile it instead.');
    const commander = cardDef('r-g2e-cmdr', 'Legendary Creature — Elder Demon');
    const deck: InitDeckCard[] = [
      { def: source, isCommander: false },
      { def: commander, isCommander: true },
      ...makeDeck(20),
    ];
    let state = initGame(deck, 1);
    const srcId = idOf(state, 'r-g2e-cmdr-src');
    const cmdrId = idOf(state, 'r-g2e-cmdr');
    state = applyCommand(state, { type: 'moveCard', cardId: srcId, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: cmdrId, to: 'battlefield', position: 'bottom' }).state;

    state = applyCommand(state, { type: 'moveCard', cardId: cmdrId, to: 'graveyard', position: 'bottom' }).state;
    // Engine-level: the commander lands in the graveyard (hook exempt), so the
    // store-level 903.9a machinery — which searches for a toZone==='graveyard'
    // event — still functions exactly as before this slice.
    expect(state.cards[cmdrId].zone).toBe('graveyard');
    expect(lastZoneChangeFor(state, cmdrId)?.toZone).toBe('graveyard');
    expect(lastZoneChangeFor(state, cmdrId)?.replacementApplied).toBeUndefined();
  });

  it('non-graveyard destinations are untouched even with the source on the battlefield (exile/hand/library moves unchanged)', () => {
    const source = cardDef('r-g2e-other-dest', 'Enchantment', 'If a card or token would be put into your graveyard from anywhere, exile it instead.');
    const mover = cardDef('r-g2e-other-mover', 'Creature — Bear');
    let state = gameWith([source, mover]);
    const srcId = idOf(state, 'r-g2e-other-dest');
    const movId = idOf(state, 'r-g2e-other-mover');
    state = applyCommand(state, { type: 'moveCard', cardId: srcId, to: 'battlefield', position: 'bottom' }).state;

    state = applyCommand(state, { type: 'moveCard', cardId: movId, to: 'hand', position: 'bottom' }).state;
    expect(state.cards[movId].zone).toBe('hand');
    expect(lastZoneChangeFor(state, movId)?.replacementApplied).toBeUndefined();
  });
});
