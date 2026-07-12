import { applyCommand } from '../../engine/commands';
import { initGame, type InitDeckCard } from '../../engine/init';
import type { GameState, ZoneId } from '../../engine/types';
import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import type { CardDef } from '../../types/card';

export const VISUAL_FIXTURE_SCENARIOS = [
  'mulligan',
  'hand',
  'lands',
  'battlefield',
  'stack',
  'graveyard',
] as const;

export type VisualFixtureScenario = (typeof VISUAL_FIXTURE_SCENARIOS)[number];

export interface VisualFixture {
  scenario: VisualFixtureScenario;
  snapshot: GameSnapshot;
  mulliganDecisionPending: boolean;
  warnings: string[];
}

const SEED = 240712;

function cardImage(name: string, tone: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680" viewBox="0 0 488 680">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${tone}"/><stop offset="1" stop-color="#0d131c"/></linearGradient></defs>
    <rect width="488" height="680" rx="30" fill="#090d13"/><rect x="18" y="18" width="452" height="644" rx="24" fill="url(#g)" stroke="#d8b06a" stroke-width="5"/>
    <rect x="42" y="48" width="404" height="62" rx="12" fill="#f2eadc" fill-opacity=".92"/>
    <text x="60" y="88" font-family="sans-serif" font-size="28" font-weight="700" fill="#111827">${name}</text>
    <circle cx="244" cy="320" r="120" fill="#fff" fill-opacity=".12"/><path d="M132 470h224v116H132z" fill="#f7f2e8" fill-opacity=".86"/>
    <text x="154" y="520" font-family="sans-serif" font-size="22" fill="#17202e">D4a visual fixture</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function makeCard(
  scryfallId: string,
  name: string,
  typeLine: string,
  tone: string,
  extra: Partial<CardDef> = {},
): CardDef {
  return {
    scryfallId,
    oracleId: scryfallId,
    name,
    printedName: name,
    lang: 'ja',
    layout: 'normal',
    cmc: typeLine.includes('Land') ? 0 : 2,
    colorIdentity: [],
    typeLine,
    faces: [
      {
        name,
        printedName: name,
        typeLine,
        printedTypeLine: typeLine,
        oracleText: 'D4a visual fixture.',
        printedText: 'D4a表示検証用カード。',
        imageUrl: cardImage(name, tone),
        ...(typeLine.includes('Creature') ? { power: '2', toughness: '2' } : {}),
      },
    ],
    ...extra,
  };
}

function entry(def: CardDef, isCommander = false): InitDeckCard {
  return { def, isCommander };
}

function fixtureDeck(): InitDeckCard[] {
  const deck: InitDeckCard[] = [
    entry(makeCard('fixture-commander', '検証統率者', 'Legendary Creature — Wizard', '#6d4f8c'), true),
  ];

  for (let index = 1; index <= 8; index += 1) {
    deck.push(entry(makeCard(`fixture-hand-${index}`, `手札 ${index}`, index % 3 === 0 ? 'Instant' : 'Creature — Scout', '#315c7d')));
  }
  for (let index = 1; index <= 3; index += 1) {
    deck.push(entry(makeCard(`fixture-basic-${index}`, 'Forest', 'Basic Land — Forest', '#315f42', { producedMana: ['G'] })));
  }
  const specialLands = [
    ['fixture-special-1', 'Command Tower', '#66552f'],
    ['fixture-special-2', 'Breeding Pool', '#285f67'],
    ['fixture-special-3', 'Reliquary Tower', '#555b66'],
  ] as const;
  for (const [id, name, tone] of specialLands) {
    deck.push(entry(makeCard(id, name, 'Land', tone, { producedMana: ['C'] })));
  }
  for (let index = 1; index <= 6; index += 1) {
    deck.push(entry(makeCard(`fixture-creature-${index}`, `クリーチャー ${index}`, 'Creature — Beast', '#70433c')));
  }
  for (let index = 1; index <= 4; index += 1) {
    deck.push(entry(makeCard(`fixture-permanent-${index}`, `置物 ${index}`, index % 2 === 0 ? 'Enchantment' : 'Artifact', '#56506f')));
  }
  for (let index = 1; index <= 2; index += 1) {
    deck.push(entry(makeCard(`fixture-stack-${index}`, `スタック ${index}`, index === 1 ? 'Instant' : 'Sorcery', '#334f88')));
  }
  for (let index = 1; index <= 10; index += 1) {
    deck.push(entry(makeCard(`fixture-grave-${index}`, `墓地 ${index}`, 'Creature — Spirit', '#4c4655')));
  }
  for (let index = 1; index <= 2; index += 1) {
    deck.push(entry(makeCard(`fixture-exile-${index}`, `追放 ${index}`, 'Artifact', '#776b45')));
  }
  for (let index = 1; index <= 12; index += 1) {
    deck.push(entry(makeCard(`fixture-library-${index}`, `山札 ${index}`, 'Sorcery', '#374151')));
  }
  return deck;
}

function idsWithPrefix(state: GameState, prefix: string): string[] {
  return Object.values(state.cards)
    .filter((card) => card.defId.startsWith(prefix))
    .map((card) => card.id)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function moveCards(state: GameState, cardIds: readonly string[], to: ZoneId): GameState {
  let next = state;
  for (const cardId of cardIds) {
    next = applyCommand(next, { type: 'moveCard', cardId, to, position: 'top' }).state;
  }
  return next;
}

function setTapped(state: GameState, cardId: string): GameState {
  return applyCommand(state, { type: 'setTapped', cardId, tapped: true }).state;
}

function buildState(scenario: VisualFixtureScenario): GameState {
  let state = initGame(fixtureDeck(), SEED);
  const handIds = idsWithPrefix(state, 'fixture-hand-');
  state = moveCards(state, handIds.slice(0, scenario === 'mulligan' ? 7 : 8), 'hand');

  if (scenario === 'mulligan' || scenario === 'hand') return state;

  const basicIds = idsWithPrefix(state, 'fixture-basic-');
  const specialIds = idsWithPrefix(state, 'fixture-special-');
  state = moveCards(state, [...basicIds, ...specialIds], 'battlefield');
  state = setTapped(state, basicIds[1]);
  state = setTapped(state, specialIds[1]);
  if (scenario === 'lands') return { ...state, phase: 'main1' };

  state = moveCards(state, idsWithPrefix(state, 'fixture-creature-'), 'battlefield');
  state = moveCards(state, idsWithPrefix(state, 'fixture-permanent-'), 'battlefield');
  state = applyCommand(state, {
    type: 'addCounters',
    cardId: idsWithPrefix(state, 'fixture-creature-')[0],
    counterType: '+1/+1',
    delta: 2,
  }).state;
  if (scenario === 'battlefield') return { ...state, phase: 'main1', turn: 4 };

  state = moveCards(state, idsWithPrefix(state, 'fixture-stack-'), 'stack');
  if (scenario === 'stack') return { ...state, phase: 'main2', turn: 4 };

  state = moveCards(state, idsWithPrefix(state, 'fixture-grave-'), 'graveyard');
  state = moveCards(state, idsWithPrefix(state, 'fixture-exile-'), 'exile');
  return { ...state, phase: 'end', turn: 6, life: 31 };
}

export function isVisualFixtureScenario(value: string | null): value is VisualFixtureScenario {
  return VISUAL_FIXTURE_SCENARIOS.some((scenario) => scenario === value);
}

export function buildVisualFixture(scenario: VisualFixtureScenario): VisualFixture {
  const state = buildState(scenario);
  return {
    scenario,
    snapshot: {
      version: SNAPSHOT_VERSION,
      state,
      deck: fixtureDeck(),
      autoAdvanceToMain: false,
    },
    mulliganDecisionPending: scenario === 'mulligan',
    warnings:
      scenario === 'stack' || scenario === 'graveyard'
        ? ['D4a fixture: 対象確認が必要です。', 'D4a fixture: 誘発候補があります。']
        : [],
  };
}
