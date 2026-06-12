import type { CardDef, ManaColor } from '../types/card';
import { isCommander } from './commander';
import type {
  CardInstance,
  GameState,
  LogEntry,
  ManaPool,
  Phase,
  ZoneId,
} from './types';
import { PHASE_ORDER } from './types';

export type GameCommand =
  | { type: 'moveCard'; cardId: string; to: ZoneId; position: 'top' | 'bottom' | number }
  | { type: 'setTapped'; cardId: string; tapped: boolean }
  | { type: 'setFace'; cardId: string; faceIndex: number }
  | { type: 'setFaceDown'; cardId: string; faceDown: boolean }
  | { type: 'addCounters'; cardId: string; counterType: string; delta: number }
  | { type: 'attach'; cardId: string; to: string | undefined }
  | { type: 'adjustLife'; delta: number }
  | { type: 'adjustPlayerCounter'; kind: 'poison' | 'energy' | 'experience'; delta: number }
  | { type: 'adjustCommanderDamage'; label: string; delta: number }
  | { type: 'addMana'; color: ManaColor; amount: number }
  | { type: 'payMana'; payment: ManaPool }
  | { type: 'clearManaPool' }
  | { type: 'draw'; count: number }
  | { type: 'shuffle'; order: string[] }
  | { type: 'putOnBottom'; cardIds: string[] }
  | { type: 'castSpell'; cardId: string; payment: ManaPool; forced: boolean }
  | { type: 'castCommander'; cardId: string; payment: ManaPool; forced: boolean }
  | {
      type: 'createToken';
      name: string;
      typeLine: string;
      power?: string;
      toughness?: string;
      quantity: number;
    }
  | { type: 'nextPhase'; drawnHandled?: boolean }
  | { type: 'nextTurn' }
  | { type: 'mulligan'; order: string[] };

export interface ApplyResult {
  state: GameState;
  warnings: string[];
}

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}

// ---------------------------------------------------------------------------
// Internal mutable working copy. We build a shallow-cloned state, mutate only
// the parts we touch (structural sharing), then return it. The input `state`
// is never mutated (I4).
// ---------------------------------------------------------------------------

interface Draft {
  state: GameState;
  warnings: string[];
  nextSeq: number;
}

const ZONE_LABELS: Record<ZoneId, string> = {
  library: 'ライブラリ',
  hand: '手札',
  battlefield: '戦場',
  graveyard: '墓地',
  exile: '追放',
  command: '統率',
};

function emptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

/** Shallow clone of state for editing. Sub-collections cloned lazily. */
function makeDraft(state: GameState): Draft {
  const maxSeq = state.log.reduce((m, e) => Math.max(m, e.seq), -1);
  return {
    state: {
      ...state,
      cards: { ...state.cards },
      zones: { ...state.zones },
      manaPool: { ...state.manaPool },
      commanders: state.commanders,
      commanderDamage: { ...state.commanderDamage },
      log: state.log.slice(),
    },
    warnings: [],
    nextSeq: maxSeq + 1,
  };
}

function cardName(def: CardDef | undefined): string {
  if (!def) return '不明なカード';
  return def.printedName ?? def.name;
}

function nameOf(draft: Draft, cardId: string): string {
  const card = draft.state.cards[cardId];
  if (!card) return '不明なカード';
  return `《${cardName(draft.state.defs[card.defId])}》`;
}

function pushLog(draft: Draft, message: string): void {
  const entry: LogEntry = {
    seq: draft.nextSeq++,
    turn: draft.state.turn,
    phase: draft.state.phase,
    message,
  };
  draft.state.log = [...draft.state.log, entry];
}

function requireCard(draft: Draft, cardId: string): CardInstance {
  const card = draft.state.cards[cardId];
  if (!card) {
    throw new EngineError(`カードが存在しません: ${cardId}`);
  }
  return card;
}

/** Replace a card instance in the draft (clones the cards map entry). */
function setCard(draft: Draft, card: CardInstance): void {
  draft.state.cards = { ...draft.state.cards, [card.id]: card };
}

/** Get a mutable clone of a zone array, installing it into the draft. */
function editZone(draft: Draft, zone: ZoneId): string[] {
  const arr = draft.state.zones[zone].slice();
  draft.state.zones = { ...draft.state.zones, [zone]: arr };
  return arr;
}

function removeFromCurrentZone(draft: Draft, cardId: string): ZoneId {
  const card = draft.state.cards[cardId];
  const from = card.zone;
  const arr = editZone(draft, from);
  const idx = arr.indexOf(cardId);
  if (idx >= 0) arr.splice(idx, 1);
  return from;
}

function insertIntoZone(
  arr: string[],
  cardId: string,
  position: 'top' | 'bottom' | number
): void {
  if (position === 'top') {
    arr.unshift(cardId);
  } else if (position === 'bottom') {
    arr.push(cardId);
  } else {
    const clamped = Math.max(0, Math.min(position, arr.length));
    arr.splice(clamped, 0, cardId);
  }
}

/** Reset card state on a true zone change (not battlefield->battlefield). */
function resetCardForZoneChange(card: CardInstance, to: ZoneId): CardInstance {
  return {
    ...card,
    zone: to,
    tapped: false,
    faceDown: false,
    faceIndex: 0,
    counters: {},
    attachedTo: undefined,
  };
}

/**
 * Core move. Handles token disappearance (I2), state reset, position.
 * Returns true if the card moved (false if it vanished as a token).
 */
function moveCardInternal(
  draft: Draft,
  cardId: string,
  to: ZoneId,
  position: 'top' | 'bottom' | number,
  log: boolean
): void {
  const card = requireCard(draft, cardId);
  const from = card.zone;
  const sameBattlefield = from === 'battlefield' && to === 'battlefield';

  // Token leaving battlefield -> ceases to exist.
  if (card.isToken && from === 'battlefield' && to !== 'battlefield') {
    const name = nameOf(draft, cardId);
    removeFromCurrentZone(draft, cardId);
    const cards = { ...draft.state.cards };
    delete cards[cardId];
    draft.state.cards = cards;
    if (log) {
      pushLog(draft, `トークン${name}が${ZONE_LABELS[to]}へ移動したため消滅しました。`);
    }
    return;
  }

  removeFromCurrentZone(draft, cardId);
  const dest = editZone(draft, to);

  // battlefield destination always appended (UI manages order otherwise).
  const effectivePosition: 'top' | 'bottom' | number =
    to === 'battlefield' ? 'bottom' : position;
  insertIntoZone(dest, cardId, effectivePosition);

  const updated = sameBattlefield
    ? { ...card, zone: to }
    : resetCardForZoneChange(card, to);
  setCard(draft, updated);

  if (log && !sameBattlefield) {
    pushLog(
      draft,
      `${nameOf(draft, cardId)}を${ZONE_LABELS[from]}から${ZONE_LABELS[to]}へ移動しました。`
    );
  }
}

function clearPool(draft: Draft, reason: string | null): void {
  const pool = draft.state.manaPool;
  const total = pool.W + pool.U + pool.B + pool.R + pool.G + pool.C;
  draft.state.manaPool = emptyManaPool();
  if (reason && total > 0) {
    pushLog(draft, reason);
  }
}

function subtractPayment(draft: Draft, payment: ManaPool): { shortfall: number } {
  const pool = { ...draft.state.manaPool };
  let shortfall = 0;
  for (const color of ['W', 'U', 'B', 'R', 'G', 'C'] as ManaColor[]) {
    const want = payment[color];
    if (want <= 0) continue;
    const have = pool[color];
    const pay = Math.min(want, have);
    pool[color] = have - pay;
    shortfall += want - pay;
  }
  draft.state.manaPool = pool;
  return { shortfall };
}

function describePayment(payment: ManaPool): string {
  const parts: string[] = [];
  for (const color of ['W', 'U', 'B', 'R', 'G', 'C'] as ManaColor[]) {
    if (payment[color] > 0) parts.push(`${color}${payment[color]}`);
  }
  return parts.length ? parts.join('') : '0';
}

// ---------------------------------------------------------------------------
// Phase / turn handling
// ---------------------------------------------------------------------------

const PHASE_LABELS: Record<Phase, string> = {
  untap: 'アンタップ',
  upkeep: 'アップキープ',
  draw: 'ドロー',
  main1: 'メイン1',
  combat: '戦闘',
  main2: 'メイン2',
  end: '終了',
};

function untapAll(draft: Draft): void {
  let changed = false;
  const cards = { ...draft.state.cards };
  for (const id of draft.state.zones.battlefield) {
    const c = cards[id];
    if (c && c.tapped) {
      cards[id] = { ...c, tapped: false };
      changed = true;
    }
  }
  if (changed) {
    draft.state.cards = cards;
    pushLog(draft, '戦場のすべてのパーマネントをアンタップしました。');
  }
}

function drawCards(draft: Draft, count: number): number {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    const lib = draft.state.zones.library;
    if (lib.length === 0) break;
    const topId = lib[0];
    moveCardInternal(draft, topId, 'hand', 'bottom', false);
    drawn++;
  }
  return drawn;
}

function enterPhase(draft: Draft, phase: Phase, drawnHandled: boolean): void {
  draft.state.phase = phase;
  if (phase === 'untap') {
    untapAll(draft);
  }
  if (phase === 'draw' && !drawnHandled) {
    if (draft.state.turn === 1) {
      // 先手想定: turn 1 はドローしない
    } else {
      const drawn = drawCards(draft, 1);
      if (drawn > 0) {
        pushLog(draft, 'カードを1枚引きました。');
      } else {
        draft.warnings.push('ライブラリが空のためドローできません。');
      }
    }
  }
}

function applyNextPhase(draft: Draft, drawnHandled: boolean): void {
  clearPool(draft, 'フェイズ移行によりマナプールが空になりました。');
  const idx = PHASE_ORDER.indexOf(draft.state.phase);
  if (idx === PHASE_ORDER.length - 1) {
    // end -> next turn untap
    draft.state.turn += 1;
    enterPhase(draft, 'untap', drawnHandled);
    pushLog(draft, `ターン${draft.state.turn}に移行しました。`);
  } else {
    const next = PHASE_ORDER[idx + 1];
    enterPhase(draft, next, drawnHandled);
    pushLog(draft, `${PHASE_LABELS[next]}フェイズに移行しました。`);
  }
}

function applyNextTurn(draft: Draft): void {
  clearPool(draft, 'ターン移行によりマナプールが空になりました。');
  draft.state.turn += 1;
  enterPhase(draft, 'untap', false);
  pushLog(draft, `ターン${draft.state.turn}(アンタップ)に移行しました。`);
}

// ---------------------------------------------------------------------------
// Cast handling
// ---------------------------------------------------------------------------

function typeLineOf(draft: Draft, card: CardInstance): string {
  const def = draft.state.defs[card.defId];
  if (!def) return '';
  const face = def.faces[card.faceIndex] ?? def.faces[0];
  return (face?.typeLine ?? def.typeLine ?? '').toString();
}

function castDestination(typeLine: string): ZoneId {
  if (/Instant|Sorcery/i.test(typeLine)) return 'graveyard';
  return 'battlefield';
}

function applyCast(
  draft: Draft,
  cardId: string,
  payment: ManaPool,
  forced: boolean,
  commander: boolean
): void {
  const card = requireCard(draft, cardId);

  if (commander) {
    if (!isCommander(draft.state, cardId)) {
      throw new EngineError(`統率者ではないカードです: ${cardId}`);
    }
    if (card.zone !== 'command') {
      throw new EngineError(`統率者は統率領域からのみキャストできます: ${cardId}`);
    }
  }

  const { shortfall } = subtractPayment(draft, payment);
  if (shortfall > 0) {
    const msg = forced
      ? `マナが${shortfall}点不足していますが強行しました。`
      : `マナが${shortfall}点不足(強行)。`;
    draft.warnings.push(msg);
  } else if (forced) {
    // The store passes forced=true when the solver could not fully pay; the
    // payment itself never exceeds the pool, so warn off the flag, not the
    // pool subtraction.
    draft.warnings.push('マナ不足のまま強行でキャストしました。');
  }

  const typeLine = typeLineOf(draft, card);
  const dest = castDestination(typeLine);

  const name = nameOf(draft, cardId);
  const payStr = describePayment(payment);

  if (commander) {
    draft.state.commanders = draft.state.commanders.map((c) =>
      c.cardId === cardId ? { ...c, castCount: c.castCount + 1 } : c
    );
    moveCardInternal(draft, cardId, dest, 'bottom', false);
    pushLog(draft, `統率者${name}をキャストしました(支払い: ${payStr})。`);
  } else {
    moveCardInternal(draft, cardId, dest, 'bottom', false);
    pushLog(draft, `${name}をキャストしました(支払い: ${payStr})。`);
  }
}

// ---------------------------------------------------------------------------
// Token creation
// ---------------------------------------------------------------------------

function nextTokenId(state: GameState): (offset: number) => string {
  let max = 0;
  for (const id of Object.keys(state.cards)) {
    if (id.startsWith('t')) {
      const n = parseInt(id.slice(1), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return (offset: number) => `t${max + offset}`;
}

function nextTokenDefId(state: GameState): string {
  let max = 0;
  for (const id of Object.keys(state.defs)) {
    if (id.startsWith('token:')) {
      const n = parseInt(id.slice('token:'.length), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `token:${max + 1}`;
}

function applyCreateToken(
  draft: Draft,
  name: string,
  typeLine: string,
  power: string | undefined,
  toughness: string | undefined,
  quantity: number
): void {
  const qty = Math.max(0, Math.floor(quantity));
  if (qty === 0) return;

  const defId = nextTokenDefId(draft.state);
  const def: CardDef = {
    scryfallId: defId,
    oracleId: defId,
    name,
    lang: 'en',
    layout: 'token',
    cmc: 0,
    colorIdentity: [],
    typeLine,
    faces: [
      {
        name,
        typeLine,
        power,
        toughness,
      },
    ],
  };
  draft.state.defs = { ...draft.state.defs, [defId]: def };

  const genId = nextTokenId(draft.state);
  const cards = { ...draft.state.cards };
  const battlefield = editZone(draft, 'battlefield');
  for (let i = 1; i <= qty; i++) {
    const id = genId(i);
    cards[id] = {
      id,
      defId,
      zone: 'battlefield',
      tapped: false,
      faceIndex: 0,
      faceDown: false,
      counters: {},
      isToken: true,
      isCommander: false,
    };
    battlefield.push(id);
  }
  draft.state.cards = cards;
  pushLog(draft, `トークン《${name}》を${qty}個生成しました。`);
}

// ---------------------------------------------------------------------------
// Mulligan
// ---------------------------------------------------------------------------

function applyMulligan(draft: Draft, order: string[]): void {
  const hand = draft.state.zones.hand.slice();
  // Move all hand cards back into library (state reset), then reorder library
  // by the provided permutation (hand + library combined).
  for (const id of hand) {
    moveCardInternal(draft, id, 'library', 'bottom', false);
  }
  // Validate + apply order as the new library permutation.
  const lib = draft.state.zones.library;
  const valid =
    order.length === lib.length && new Set(order).size === order.length && order.every((id) => lib.includes(id));
  if (valid) {
    draft.state.zones = { ...draft.state.zones, library: order.slice() };
  } else {
    throw new EngineError('mulligan の order がライブラリの順列ではありません。');
  }
  draft.state.mulliganCount += 1;
  pushLog(draft, `マリガンしました(${draft.state.mulliganCount}回目)。`);
}

function applyShuffle(draft: Draft, order: string[]): void {
  const lib = draft.state.zones.library;
  const valid =
    order.length === lib.length &&
    new Set(order).size === order.length &&
    order.every((id) => lib.includes(id));
  if (!valid) {
    throw new EngineError('shuffle の order がライブラリの順列ではありません。');
  }
  draft.state.zones = { ...draft.state.zones, library: order.slice() };
  pushLog(draft, 'ライブラリをシャッフルしました。');
}

function applyPutOnBottom(draft: Draft, cardIds: string[]): void {
  for (const id of cardIds) {
    requireCard(draft, id);
    moveCardInternal(draft, id, 'library', 'bottom', false);
  }
  if (cardIds.length > 0) {
    pushLog(draft, `${cardIds.length}枚をライブラリの一番下に置きました。`);
  }
}

// ---------------------------------------------------------------------------
// applyCommand
// ---------------------------------------------------------------------------

export function applyCommand(state: GameState, cmd: GameCommand): ApplyResult {
  const draft = makeDraft(state);

  switch (cmd.type) {
    case 'moveCard': {
      requireCard(draft, cmd.cardId);
      moveCardInternal(draft, cmd.cardId, cmd.to, cmd.position, true);
      break;
    }
    case 'setTapped': {
      const card = requireCard(draft, cmd.cardId);
      if (card.tapped !== cmd.tapped) {
        setCard(draft, { ...card, tapped: cmd.tapped });
        pushLog(
          draft,
          `${nameOf(draft, cmd.cardId)}を${cmd.tapped ? 'タップ' : 'アンタップ'}しました。`
        );
      }
      break;
    }
    case 'setFace': {
      const card = requireCard(draft, cmd.cardId);
      if (card.faceIndex !== cmd.faceIndex) {
        setCard(draft, { ...card, faceIndex: cmd.faceIndex });
        pushLog(draft, `${nameOf(draft, cmd.cardId)}のフェイスを切り替えました。`);
      }
      break;
    }
    case 'setFaceDown': {
      const card = requireCard(draft, cmd.cardId);
      if (card.faceDown !== cmd.faceDown) {
        setCard(draft, { ...card, faceDown: cmd.faceDown });
        pushLog(
          draft,
          `${nameOf(draft, cmd.cardId)}を${cmd.faceDown ? '裏向き' : '表向き'}にしました。`
        );
      }
      break;
    }
    case 'addCounters': {
      const card = requireCard(draft, cmd.cardId);
      const current = card.counters[cmd.counterType] ?? 0;
      const next = Math.max(0, current + cmd.delta);
      const counters = { ...card.counters };
      if (next === 0) {
        delete counters[cmd.counterType];
      } else {
        counters[cmd.counterType] = next;
      }
      setCard(draft, { ...card, counters });
      pushLog(
        draft,
        `${nameOf(draft, cmd.cardId)}の${cmd.counterType}カウンターを${next}個にしました。`
      );
      break;
    }
    case 'attach': {
      const card = requireCard(draft, cmd.cardId);
      if (cmd.to !== undefined) {
        requireCard(draft, cmd.to);
      }
      setCard(draft, { ...card, attachedTo: cmd.to });
      if (cmd.to !== undefined) {
        pushLog(
          draft,
          `${nameOf(draft, cmd.cardId)}を${nameOf(draft, cmd.to)}に付けました。`
        );
      } else {
        pushLog(draft, `${nameOf(draft, cmd.cardId)}の装備/付与を外しました。`);
      }
      break;
    }
    case 'adjustLife': {
      draft.state.life += cmd.delta;
      const sign = cmd.delta >= 0 ? '+' : '';
      pushLog(draft, `ライフが${sign}${cmd.delta}(現在${draft.state.life})。`);
      break;
    }
    case 'adjustPlayerCounter': {
      const current = draft.state[cmd.kind];
      const next = Math.max(0, current + cmd.delta);
      draft.state[cmd.kind] = next;
      const label =
        cmd.kind === 'poison' ? '毒' : cmd.kind === 'energy' ? 'エネルギー' : '経験';
      pushLog(draft, `${label}カウンターを${next}個にしました。`);
      break;
    }
    case 'adjustCommanderDamage': {
      const current = draft.state.commanderDamage[cmd.label] ?? 0;
      const next = Math.max(0, current + cmd.delta);
      const cd = { ...draft.state.commanderDamage };
      cd[cmd.label] = next;
      draft.state.commanderDamage = cd;
      pushLog(draft, `統率者ダメージ(${cmd.label})を${next}にしました。`);
      break;
    }
    case 'addMana': {
      const amount = Math.max(0, cmd.amount);
      if (amount > 0) {
        const pool = { ...draft.state.manaPool };
        pool[cmd.color] += amount;
        draft.state.manaPool = pool;
        pushLog(draft, `${cmd.color}マナを${amount}点加えました。`);
      }
      break;
    }
    case 'payMana': {
      const { shortfall } = subtractPayment(draft, cmd.payment);
      if (shortfall > 0) {
        draft.warnings.push(`マナが${shortfall}点不足(強行)。`);
      }
      pushLog(draft, `マナを支払いました(${describePayment(cmd.payment)})。`);
      break;
    }
    case 'clearManaPool': {
      clearPool(draft, 'マナプールを空にしました。');
      break;
    }
    case 'draw': {
      const drawn = drawCards(draft, Math.max(0, cmd.count));
      pushLog(draft, `カードを${drawn}枚引きました。`);
      if (drawn < cmd.count) {
        draft.warnings.push('ライブラリが足りずすべて引けませんでした。');
      }
      break;
    }
    case 'shuffle': {
      applyShuffle(draft, cmd.order);
      break;
    }
    case 'putOnBottom': {
      applyPutOnBottom(draft, cmd.cardIds);
      break;
    }
    case 'castSpell': {
      applyCast(draft, cmd.cardId, cmd.payment, cmd.forced, false);
      break;
    }
    case 'castCommander': {
      applyCast(draft, cmd.cardId, cmd.payment, cmd.forced, true);
      break;
    }
    case 'createToken': {
      applyCreateToken(
        draft,
        cmd.name,
        cmd.typeLine,
        cmd.power,
        cmd.toughness,
        cmd.quantity
      );
      break;
    }
    case 'nextPhase': {
      applyNextPhase(draft, cmd.drawnHandled ?? false);
      break;
    }
    case 'nextTurn': {
      applyNextTurn(draft);
      break;
    }
    case 'mulligan': {
      applyMulligan(draft, cmd.order);
      break;
    }
  }

  return { state: draft.state, warnings: draft.warnings };
}
