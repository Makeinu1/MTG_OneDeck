import { applyCommand } from '../../engine/commands';
import { initGame, type InitDeckCard } from '../../engine/init';
import {
  DEFAULT_OPPONENT_ID,
  DEFAULT_OPPONENT_LIFE_LABEL,
  objectIdOf,
  syncDerivedViews,
  type GameState,
  type ObjectSnapshot,
  type ZoneId,
} from '../../engine/types';
import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import type { CardDef } from '../../types/card';

export const VISUAL_FIXTURE_SCENARIOS = [
  'mulligan',
  'hand',
  'hand7',
  'hand10',
  'hand15',
  'land-drop-empty',
  'hand60',
  'hand100',
  'lands',
  'mana-multicolor',
  'battlefield',
  'tabletop-manual',
  'commander-battlefield',
  'stack',
  'trigger-order',
  'graveyard',
  'partner',
  'partner-away',
  'board-dense',
  'board-sparse',
  'mobile-density',
  'board-overflow',
  'lands-overflow',
  'stack-deep',
  'graveyard-deep',
  'ambient-macro-empty',
  'ambient-macro-dense',
  'token-showcase',
  'token-image-missing',
  'card-facedown',
  'card-dfc-front',
  'card-dfc-back',
  'theme-light',
  'theme-dark',
  'opponent-board',
] as const;

export type VisualFixtureScenario = (typeof VISUAL_FIXTURE_SCENARIOS)[number];

export interface VisualFixture {
  scenario: VisualFixtureScenario;
  snapshot: GameSnapshot;
  mulliganDecisionPending: boolean;
  warnings: string[];
}

const SEED = 240712;
const CARD_IMAGE_CACHE = new Map<string, string>();
const FIXTURE_DECK_CACHE = new Map<string, InitDeckCard[]>();
const FIXTURE_INITIAL_STATE_CACHE = new Map<string, GameState>();
const VISUAL_FIXTURE_CACHE = new Map<VisualFixtureScenario, VisualFixture>();

function isCompactCardScenario(scenario: VisualFixtureScenario | undefined): boolean {
  return scenario === 'token-showcase'
    || scenario === 'token-image-missing'
    || scenario === 'card-facedown'
    || scenario === 'card-dfc-front'
    || scenario === 'card-dfc-back';
}

function fixtureFamily(scenario: VisualFixtureScenario): string {
  if (scenario === 'partner' || scenario === 'partner-away') return 'partner';
  if (scenario === 'board-dense') return 'board-dense';
  if (scenario === 'ambient-macro-empty' || scenario === 'ambient-macro-dense') return 'ambient-macro';
  if (scenario === 'lands-overflow') return 'lands-overflow';
  if (scenario === 'stack-deep') return 'stack-deep';
  if (scenario === 'card-facedown') return 'card-facedown';
  if (scenario === 'card-dfc-front' || scenario === 'card-dfc-back') return 'card-dfc';
  if (scenario === 'token-showcase' || scenario === 'token-image-missing') return 'token';
  return 'default';
}

function cardImage(name: string, tone: string): string {
  const cacheKey = `${name}\u0000${tone}`;
  const cached = CARD_IMAGE_CACHE.get(cacheKey);
  if (cached) return cached;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680" viewBox="0 0 488 680">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${tone}"/><stop offset="1" stop-color="#0d131c"/></linearGradient></defs>
    <rect width="488" height="680" rx="30" fill="#090d13"/><rect x="18" y="18" width="452" height="644" rx="24" fill="url(#g)" stroke="#d8b06a" stroke-width="5"/>
    <rect x="42" y="48" width="404" height="62" rx="12" fill="#f2eadc" fill-opacity=".92"/>
    <text x="60" y="88" font-family="sans-serif" font-size="28" font-weight="700" fill="#111827">${name}</text>
    <circle cx="244" cy="320" r="120" fill="#fff" fill-opacity=".12"/><path d="M132 470h224v116H132z" fill="#f7f2e8" fill-opacity=".86"/>
    <text x="154" y="520" font-family="sans-serif" font-size="22" fill="#17202e">D4a visual fixture</text>
  </svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  CARD_IMAGE_CACHE.set(cacheKey, url);
  return url;
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

function withFixtureRules(def: CardDef, oracleText: string, printedText: string): CardDef {
  return {
    ...def,
    faces: def.faces.map((face, index) => index === 0
      ? { ...face, oracleText, printedText }
      : face),
  };
}

function entry(def: CardDef, isCommander = false): InitDeckCard {
  return { def, isCommander };
}

function fixtureDeck(scenario?: VisualFixtureScenario): InitDeckCard[] {
  const deck: InitDeckCard[] = [
    entry(makeCard('fixture-commander', '検証統率者', 'Legendary Creature — Wizard', '#6d4f8c'), true),
  ];

  if (scenario === 'card-facedown') {
    deck.push(entry(makeCard('fixture-facedown', '秘密のカード', 'Creature — Shapeshifter', '#2f516b')));
  }
  if (scenario === 'card-dfc-front' || scenario === 'card-dfc-back') {
    deck.push(entry({
      ...makeCard('fixture-dfc', '暁の研究者 // 夜の発明家', 'Creature — Human Artificer', '#416889'),
      layout: 'transform',
      faces: [
        {
          name: 'Dawn Researcher', printedName: '暁の研究者', typeLine: 'Creature — Human Artificer',
          printedTypeLine: 'クリーチャー — 人間・工匠', oracleText: 'Transform Dawn Researcher.',
          printedText: '暁の研究者を変身させる。', imageUrl: cardImage('暁の研究者', '#416889'), power: '2', toughness: '3',
        },
        {
          name: 'Night Inventor', printedName: '夜の発明家', typeLine: 'Creature — Human Artificer',
          printedTypeLine: 'クリーチャー — 人間・工匠', oracleText: 'Whenever an artifact enters, draw a card.',
          printedText: 'アーティファクトが出るたびカードを1枚引く。', imageUrl: cardImage('夜の発明家', '#6c3f71'), power: '4', toughness: '4',
        },
      ],
    }));
  }

  if (scenario === 'partner' || scenario === 'partner-away') {
    deck.push(entry(makeCard(
      'fixture-partner',
      '検証の相棒',
      'Legendary Creature — Artificer',
      '#8b5d3d',
    ), true));
  }

  const handCardCount = isCompactCardScenario(scenario) ? 8 : 100;
  for (let index = 1; index <= handCardCount; index += 1) {
    deck.push(entry(makeCard(`fixture-hand-${index}`, `手札 ${index}`, index % 3 === 0 ? 'Instant' : 'Creature — Scout', '#315c7d')));
  }
  if (isCompactCardScenario(scenario)) return deck;
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
    const creature = makeCard(
      `fixture-creature-${index}`,
      `クリーチャー ${index}`,
      'Creature — Beast',
      '#70433c',
    );
    deck.push(entry(index === 1
      ? withFixtureRules(creature, '{T}: Add {G}.', '{T}：{G}を加える。')
      : creature));
  }
  for (let index = 1; index <= 4; index += 1) {
    deck.push(entry(makeCard(`fixture-permanent-${index}`, `置物 ${index}`, index % 2 === 0 ? 'Enchantment' : 'Artifact', '#56506f')));
  }
  if (scenario === 'ambient-macro-empty' || scenario === 'ambient-macro-dense') {
    for (let index = 1; index <= 2; index += 1) {
      deck.push(entry(makeCard(
        `fixture-macro-land-${index}`,
        `比較土地 ${index}`,
        'Land',
        '#49684d',
        { producedMana: ['G'] },
      )));
      deck.push(entry(makeCard(
        `fixture-macro-permanent-${index}`,
        `比較置物 ${index}`,
        index === 1 ? 'Enchantment' : 'Artifact',
        '#625479',
      )));
    }
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
  if (scenario === 'board-dense') {
    for (let index = 1; index <= 6; index += 1) {
      deck.push(entry(makeCard(
        `fixture-dense-land-${index}`,
        `追加土地 ${index}`,
        'Land',
        '#3f6549',
        { producedMana: ['G'] },
      )));
    }
    for (let index = 1; index <= 8; index += 1) {
      deck.push(entry(makeCard(
        `fixture-dense-creature-${index}`,
        `追加クリーチャー ${index}`,
        'Creature — Beast',
        '#7b473f',
      )));
    }
    for (let index = 1; index <= 6; index += 1) {
      deck.push(entry(makeCard(
        `fixture-dense-permanent-${index}`,
        `追加置物 ${index}`,
        index % 2 === 0 ? 'Enchantment' : 'Artifact',
        '#5f5878',
      )));
    }
  }
  if (scenario === 'lands-overflow') {
    for (let index = 1; index <= 60; index += 1) {
      deck.push(entry(makeCard(
        `fixture-limit-land-${index}`,
        'Limit Forest',
        'Basic Land — Forest',
        '#315f42',
        { producedMana: ['G'] },
      )));
    }
    for (let index = 1; index <= 20; index += 1) {
      deck.push(entry(makeCard(
        `fixture-limit-special-${index}`,
        `限界特殊土地 ${index}`,
        'Land',
        '#4f5f66',
        { producedMana: ['C'] },
      )));
    }
  }
  if (scenario === 'stack-deep') {
    for (let index = 1; index <= 20; index += 1) {
      deck.push(entry(makeCard(
        `fixture-limit-stack-${index}`,
        `限界スタック ${index}`,
        index % 2 === 0 ? 'Instant' : 'Sorcery',
        '#334f88',
      )));
    }
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

function snapshotFor(state: GameState, cardId: string): ObjectSnapshot {
  const card = state.cards[cardId];
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  return {
    physicalCardId: card.id,
    objectId: objectIdOf(card),
    defId: card.defId,
    zone: card.zone,
    ownerId: card.ownerId,
    controllerId: card.controllerId,
    isToken: card.isToken,
    isCommander: card.isCommander,
    faceIndex: card.faceIndex,
    tapped: card.tapped,
    counters: { ...card.counters },
    typeLine: face?.typeLine ?? def?.typeLine ?? '',
    ...(typeof def?.cmc === 'number' ? { manaValue: def.cmc } : {}),
    ...(face?.power ? { power: face.power } : {}),
    ...(face?.toughness ? { toughness: face.toughness } : {}),
  };
}

function buildState(scenario: VisualFixtureScenario, initialState: GameState): GameState {
  let state = initialState;
  const handIds = idsWithPrefix(state, 'fixture-hand-');
  const handCount = scenario === 'mulligan' || scenario === 'hand7'
    ? 7
    : scenario === 'ambient-macro-empty'
      ? 0
      : scenario === 'ambient-macro-dense'
        ? 7
    : scenario === 'hand10'
      ? 10
      : scenario === 'hand15'
        ? 15
        : scenario === 'hand60'
          ? 60
          : scenario === 'hand100'
            ? 100
            : scenario === 'board-dense'
              ? 15
              : scenario === 'mobile-density'
                ? 5
                : 8;
  state = moveCards(state, handIds.slice(0, handCount), 'hand');

  if (scenario === 'ambient-macro-empty') {
    return { ...state, phase: 'main1', turn: 4 };
  }

  if (scenario === 'ambient-macro-dense') {
    const macroLandIds = idsWithPrefix(state, 'fixture-macro-land-');
    const landIds = [
      ...idsWithPrefix(state, 'fixture-basic-'),
      ...idsWithPrefix(state, 'fixture-special-'),
      ...macroLandIds,
    ];
    const permanentIds = [
      ...idsWithPrefix(state, 'fixture-creature-'),
      ...idsWithPrefix(state, 'fixture-permanent-'),
      ...idsWithPrefix(state, 'fixture-macro-permanent-'),
    ];
    state = moveCards(state, landIds, 'battlefield');
    state = moveCards(state, permanentIds, 'battlefield');
    state = moveCards(state, idsWithPrefix(state, 'fixture-stack-'), 'stack');
    return { ...state, phase: 'main2', turn: 4 };
  }

  if (scenario === 'land-drop-empty') {
    state = moveCards(state, idsWithPrefix(state, 'fixture-basic-').slice(0, 1), 'hand');
    return state;
  }

  if (scenario === 'token-showcase' || scenario === 'token-image-missing') {
    const specs = scenario === 'token-showcase'
      ? [
          ['宝物', 'Token Artifact — Treasure', 'treasure'],
          ['手掛かり', 'Token Artifact — Clue', 'clue'],
          ['食物', 'Token Artifact — Food', 'food'],
          ['血', 'Token Artifact — Blood', 'blood'],
        ] as const
      : [['カスタム・ビースト', 'Token Creature — Beast', undefined]] as const;
    for (const [name, typeLine, tokenKind] of specs) {
      state = applyCommand(state, {
        type: 'createToken', name, typeLine, power: tokenKind ? undefined : '3',
        toughness: tokenKind ? undefined : '3', quantity: scenario === 'token-image-missing' ? 8 : 2,
        tokenKind,
      }).state;
    }
    return { ...state, phase: 'main1', turn: 5 };
  }

  if (scenario === 'card-facedown') {
    const cardId = idsWithPrefix(state, 'fixture-facedown')[0];
    state = moveCards(state, [cardId], 'battlefield');
    state = applyCommand(state, { type: 'setFaceDown', cardId, faceDown: true }).state;
    return { ...state, phase: 'main1', turn: 5 };
  }

  if (scenario === 'card-dfc-front' || scenario === 'card-dfc-back') {
    const cardId = idsWithPrefix(state, 'fixture-dfc')[0];
    state = moveCards(state, [cardId], 'battlefield');
    if (scenario === 'card-dfc-back') {
      state = applyCommand(state, { type: 'setFace', cardId, faceIndex: 1 }).state;
    }
    return { ...state, phase: 'main1', turn: 5 };
  }

  if (scenario === 'partner-away') {
    const partnerId = idsWithPrefix(state, 'fixture-partner')[0];
    const payment = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    for (let cast = 0; cast < 2; cast += 1) {
      state = applyCommand(state, {
        type: 'castCommander',
        cardId: partnerId,
        payment,
        forced: false,
      }).state;
      state = applyCommand(state, {
        type: 'moveCard',
        cardId: partnerId,
        to: cast === 0 ? 'command' : 'graveyard',
        position: 'top',
      }).state;
    }
    return state;
  }

  if (
    scenario === 'mulligan'
    || scenario === 'hand'
    || scenario === 'hand7'
    || scenario === 'hand10'
    || scenario === 'hand15'
    || scenario === 'hand60'
    || scenario === 'hand100'
    || scenario === 'partner'
  ) return state;

  const basicIds = idsWithPrefix(state, 'fixture-basic-');
  const specialIds = idsWithPrefix(state, 'fixture-special-');
  const denseLandIds = idsWithPrefix(state, 'fixture-dense-land-');
  const limitLandIds = idsWithPrefix(state, 'fixture-limit-land-');
  const limitSpecialIds = idsWithPrefix(state, 'fixture-limit-special-');
  const allLandIds = [...basicIds, ...specialIds, ...denseLandIds, ...limitLandIds, ...limitSpecialIds];
  const landIds = scenario === 'board-sparse'
    ? allLandIds.slice(0, 4)
    : scenario === 'mobile-density'
      ? [...basicIds, ...specialIds.slice(0, 2)]
      : allLandIds;
  state = moveCards(state, landIds, 'battlefield');
  if (landIds.includes(basicIds[1])) state = setTapped(state, basicIds[1]);
  if (landIds.includes(specialIds[1])) state = setTapped(state, specialIds[1]);
  if (scenario === 'lands' || scenario === 'lands-overflow') return { ...state, phase: 'main1' };
  if (scenario === 'mana-multicolor') {
    return syncDerivedViews({
      ...state,
      phase: 'main1',
      manaPool: { W: 1, U: 2, B: 3, R: 4, G: 5, C: 10 },
    });
  }

  const baseCreatureIds = idsWithPrefix(state, 'fixture-creature-');
  const basePermanentIds = idsWithPrefix(state, 'fixture-permanent-');
  const creatureIds = scenario === 'board-dense'
    ? [...baseCreatureIds, ...idsWithPrefix(state, 'fixture-dense-creature-')]
    : scenario === 'board-sparse'
      ? baseCreatureIds.slice(0, 3)
      : scenario === 'mobile-density'
        ? baseCreatureIds.slice(0, 5)
        : baseCreatureIds;
  const permanentIds = scenario === 'board-dense'
    ? [...basePermanentIds, ...idsWithPrefix(state, 'fixture-dense-permanent-')]
    : scenario === 'board-sparse'
      ? basePermanentIds.slice(0, 2)
      : scenario === 'mobile-density'
        ? basePermanentIds.slice(0, 3)
        : basePermanentIds;
  state = moveCards(state, creatureIds, 'battlefield');
  state = moveCards(state, permanentIds, 'battlefield');
  if (scenario === 'trigger-order') {
    const sources = [creatureIds[0], permanentIds[0]];
    const pendingTriggers = sources.map((sourceId, index) => {
      const sourceSnapshot = snapshotFor(state, sourceId);
      const eventId = `fixture-trigger-event-${index + 1}`;
      return {
        pendingTriggerId: `fixture-pending-trigger-${index + 1}`,
        eventId,
        simultaneousGroupId: 'fixture-trigger-group',
        triggerId: index === 0 ? 'trigger.etb' : 'trigger.draw',
        sourceId,
        sourceObjectId: sourceSnapshot.objectId,
        sourceSnapshot,
        controllerId: sourceSnapshot.controllerId ?? sourceSnapshot.ownerId,
        label: index === 0
          ? '戦場に出たとき: 《クリーチャー 1》'
          : 'カードを引いたとき: 《置物 1》',
        stackPlacementBucket: 'ordinary' as const,
      };
    });
    return { ...state, phase: 'main2', turn: 4, pendingTriggers };
  }
  if (scenario === 'commander-battlefield') {
    state = moveCards(state, [state.commanders[0].cardId], 'battlefield');
  }
  state = applyCommand(state, {
    type: 'addCounters',
    cardId: baseCreatureIds[0],
    counterType: '+1/+1',
    delta: 2,
  }).state;
  if (scenario === 'board-overflow') {
    state = moveCards(state, handIds.slice(0, 60), 'battlefield');
    return { ...state, phase: 'main1', turn: 9 };
  }
  if (scenario === 'opponent-board') {
    // 相手 permanent を作る唯一の fixture。これが無いと相手盤面の検証は
    // 実アプリ8操作(取込→開始→セットアップ→相手追加→permanent追加→戻る→
    // メニュー→テーマ切替)を要し、事実上二度と実行されない=ライトが壊れた原因。
    // 3レーン(creature / その他 / 土地)と header を全部露出させる。
    const dummies: { id: string; name: string; typeLine: string; pt?: [string, string] }[] = [
      { id: 'fixture-opp-creature-1', name: '対戦相手の兵士', typeLine: 'Creature', pt: ['2', '2'] },
      { id: 'fixture-opp-creature-2', name: '対戦相手の巨人', typeLine: 'Creature', pt: ['5', '4'] },
      { id: 'fixture-opp-other-1', name: '対戦相手の護符', typeLine: 'Artifact' },
      { id: 'fixture-opp-land-1', name: '対戦相手の島', typeLine: 'Land' },
      { id: 'fixture-opp-land-2', name: '対戦相手の山', typeLine: 'Land' },
    ];
    for (const dummy of dummies) {
      state = applyCommand(state, {
        type: 'createScenarioDummy',
        cardId: dummy.id,
        defId: dummy.id + '-def',
        playerId: DEFAULT_OPPONENT_ID,
        name: dummy.name,
        typeLine: dummy.typeLine,
        power: dummy.pt?.[0],
        toughness: dummy.pt?.[1],
        tapped: dummy.id === 'fixture-opp-land-2',
        counters: {},
        keywords: [],
        isToken: false,
      }).state;
    }
    state = applyCommand(state, {
      type: 'adjustOpponentLife',
      label: DEFAULT_OPPONENT_LIFE_LABEL,
      delta: -12,
    }).state;
    return { ...state, phase: 'main1', turn: 4 };
  }
  if (
    scenario === 'battlefield'
    || scenario === 'tabletop-manual'
    || scenario === 'commander-battlefield'
    || scenario === 'board-dense'
    || scenario === 'board-sparse'
    || scenario === 'mobile-density'
    || scenario === 'theme-light'
    || scenario === 'theme-dark'
  ) {
    return { ...state, phase: 'main1', turn: 4 };
  }

  if (scenario === 'stack-deep') {
    state = moveCards(state, idsWithPrefix(state, 'fixture-limit-stack-'), 'stack');
    return { ...state, phase: 'main2', turn: 12 };
  }
  if (scenario === 'graveyard-deep') {
    state = moveCards(state, [...idsWithPrefix(state, 'fixture-grave-'), ...handIds.slice(0, 50)], 'graveyard');
    state = moveCards(state, handIds.slice(50, 90), 'exile');
    return { ...state, phase: 'main1', turn: 14 };
  }

  const stackIds = idsWithPrefix(state, 'fixture-stack-');
  state = moveCards(state, stackIds, 'stack');
  const targetId = idsWithPrefix(state, 'fixture-creature-')[1];
  const sourceId = idsWithPrefix(state, 'fixture-permanent-')[0];
  state = {
    ...state,
    cards: {
      ...state.cards,
      [stackIds[0]]: {
        ...state.cards[stackIds[0]],
        announcedX: 4,
        targetSelections: [{
          slotId: 'target-0',
          raw: 'target creature',
          kind: 'object',
          selection: {
            kind: 'object',
            physicalCardId: targetId,
            objectId: objectIdOf(state.cards[targetId]),
            snapshot: snapshotFor(state, targetId),
          },
          legalityMode: 'checked',
        }],
      },
      [stackIds[1]]: {
        ...state.cards[stackIds[1]],
        isAbility: true,
        sourceId,
        sourceSnapshot: snapshotFor(state, sourceId),
        abilityKind: 'activated',
        targetSelections: [{
          slotId: 'target-player',
          raw: 'target player',
          kind: 'player',
          selection: { kind: 'player', playerId: 'OPPONENT_A' },
          legalityMode: 'checked',
        }, {
          slotId: 'target-spell',
          raw: 'target spell',
          kind: 'object',
          selection: {
            kind: 'object',
            physicalCardId: stackIds[0],
            objectId: objectIdOf(state.cards[stackIds[0]]),
            snapshot: snapshotFor(state, stackIds[0]),
          },
          legalityMode: 'checked',
        }],
      },
    },
  };
  if (scenario === 'stack') return { ...state, phase: 'main2', turn: 4 };

  state = moveCards(state, idsWithPrefix(state, 'fixture-grave-'), 'graveyard');
  state = moveCards(state, idsWithPrefix(state, 'fixture-exile-'), 'exile');
  return { ...state, phase: 'end', turn: 6, life: 31 };
}

export function isVisualFixtureScenario(value: string | null): value is VisualFixtureScenario {
  return VISUAL_FIXTURE_SCENARIOS.some((scenario) => scenario === value);
}

export function buildVisualFixture(scenario: VisualFixtureScenario): VisualFixture {
  const cachedFixture = VISUAL_FIXTURE_CACHE.get(scenario);
  if (cachedFixture) return cachedFixture;
  const family = fixtureFamily(scenario);
  let deck = FIXTURE_DECK_CACHE.get(family);
  if (!deck) {
    deck = fixtureDeck(scenario);
    FIXTURE_DECK_CACHE.set(family, deck);
  }
  let initialState = FIXTURE_INITIAL_STATE_CACHE.get(family);
  if (!initialState) {
    initialState = initGame(deck, SEED);
    FIXTURE_INITIAL_STATE_CACHE.set(family, initialState);
  }
  const state = buildState(scenario, initialState);
  const fixture: VisualFixture = {
    scenario,
    snapshot: {
      version: SNAPSHOT_VERSION,
      state,
      deck,
      autoAdvanceToMain: false,
    },
    mulliganDecisionPending: scenario === 'mulligan',
    warnings:
      scenario === 'stack' || scenario === 'graveyard'
        ? ['D4a fixture: 対象確認が必要です。', 'D4a fixture: 誘発候補があります。']
        : [],
  };
  VISUAL_FIXTURE_CACHE.set(scenario, fixture);
  return fixture;
}
