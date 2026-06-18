import type { CardDef, ManaColor } from '../types/card';
import { isCommander } from './commander';
import type {
  AbilityKind,
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
  | { type: 'adjustOpponentLife'; label: string; delta: number }
  | { type: 'addMana'; color: ManaColor; amount: number }
  | { type: 'adjustMana'; color: ManaColor; delta: number }
  | { type: 'payMana'; payment: ManaPool }
  | { type: 'clearManaPool' }
  | { type: 'draw'; count: number }
  | { type: 'mill'; count: number }
  | { type: 'shuffle'; order: string[] }
  | { type: 'untapAll' }
  | { type: 'discard'; cardIds: string[] }
  | { type: 'putOnBottom'; cardIds: string[] }
  | { type: 'playLand'; cardId: string; forced: boolean; entersTapped?: boolean }
  | { type: 'arrangeTop'; topOrder: string[]; toBottom: string[]; toGraveyard: string[] }
  | { type: 'crackTreasure'; cardId: string; color: ManaColor }
  | { type: 'castSpell'; cardId: string; payment: ManaPool; forced: boolean }
  | { type: 'castCommander'; cardId: string; payment: ManaPool; forced: boolean }
  | { type: 'castToStack'; cardId: string; payment: ManaPool; forced: boolean }
  | { type: 'addAbilityToStack'; sourceId: string; kind: AbilityKind }
  | { type: 'resolveStackTop'; to?: ZoneId }
  | { type: 'removeStackItem'; id: string; to?: ZoneId }
  | { type: 'copyStackItem'; cardId: string }
  | { type: 'copyPermanent'; cardId: string; quantity: number }
  | {
      type: 'createToken';
      name: string;
      typeLine: string;
      power?: string;
      toughness?: string;
      quantity: number;
      producedMana?: ManaColor[];
      tokenKind?: 'treasure' | 'clue' | 'food' | 'blood';
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
  stack: 'スタック',
};

const ABILITY_KIND_LABELS: Record<AbilityKind, string> = {
  activated: '起動',
  triggered: '誘発',
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
      opponentLife: { ...state.opponentLife },
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

function nameOfCard(draft: Draft, card: CardInstance): string {
  return `《${cardName(draft.state.defs[card.defId])}》`;
}

function nameOf(draft: Draft, cardId: string): string {
  const card = draft.state.cards[cardId];
  if (!card) return '不明なカード';
  return nameOfCard(draft, card);
}

function stackNameOf(draft: Draft, card: CardInstance): string {
  if (card.isAbility && card.sourceId && draft.state.cards[card.sourceId]) {
    return nameOf(draft, card.sourceId);
  }
  return nameOfCard(draft, card);
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

function deleteCardFromState(draft: Draft, cardId: string): ZoneId {
  const from = removeFromCurrentZone(draft, cardId);
  const cards = { ...draft.state.cards };
  delete cards[cardId];

  for (const [id, card] of Object.entries(cards)) {
    if (!card.isAbility || card.sourceId !== cardId) continue;
    const stack = editZone(draft, 'stack');
    const idx = stack.indexOf(id);
    if (idx >= 0) stack.splice(idx, 1);
    delete cards[id];
  }

  draft.state.cards = cards;
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
    enteredTurn: 0,
  };
}

function currentFaceOf(draft: Draft, card: CardInstance) {
  const def = draft.state.defs[card.defId];
  return def?.faces[card.faceIndex] ?? def?.faces[0];
}

function typeLineOf(draft: Draft, card: CardInstance): string {
  const def = draft.state.defs[card.defId];
  const face = currentFaceOf(draft, card);
  return (face?.typeLine ?? def?.typeLine ?? '').toString();
}

function applyBattlefieldEntryEffects(draft: Draft, card: CardInstance): CardInstance {
  const face = currentFaceOf(draft, card);
  const counters = { ...card.counters };
  const typeLine = typeLineOf(draft, card);

  if (typeLine.includes('Planeswalker') && typeof face?.loyalty === 'string') {
    const loyalty = Number.parseInt(face.loyalty, 10);
    if (!Number.isNaN(loyalty)) {
      counters.loyalty = loyalty;
    }
  }

  if (typeLine.includes('Saga')) {
    counters.lore = 1;
    pushLog(draft, `${nameOfCard(draft, card)}は第I章で戦場に出た。`);
  }

  return {
    ...card,
    enteredTurn: draft.state.turn,
    counters,
  };
}

/** Core move. Handles disappearance rules, state reset, and destination ordering. */
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

  if (card.isAbility && to !== 'stack') {
    const name = stackNameOf(draft, card);
    deleteCardFromState(draft, cardId);
    if (log) {
      pushLog(draft, `${name}の能力が${ZONE_LABELS[to]}へ移動したため消滅しました。`);
    }
    return;
  }

  // Token leaving battlefield -> ceases to exist.
  if (card.isToken && from === 'battlefield' && to !== 'battlefield') {
    const name = nameOf(draft, cardId);
    deleteCardFromState(draft, cardId);
    if (log) {
      pushLog(draft, `トークン${name}が${ZONE_LABELS[to]}へ移動したため消滅しました。`);
    }
    return;
  }

  if (card.isCopy) {
    if (to !== 'battlefield') {
      const name = nameOfCard(draft, card);
      deleteCardFromState(draft, cardId);
      if (log) {
        pushLog(draft, `コピー${name}は消滅した。`);
      }
      return;
    }
  }

  removeFromCurrentZone(draft, cardId);
  const dest = editZone(draft, to);

  // battlefield destination always appended (UI manages order otherwise).
  const effectivePosition: 'top' | 'bottom' | number =
    to === 'battlefield' ? 'bottom' : position;
  insertIntoZone(dest, cardId, effectivePosition);

  let updated = sameBattlefield ? { ...card, zone: to } : resetCardForZoneChange(card, to);
  if (!sameBattlefield && to === 'battlefield') {
    updated = applyBattlefieldEntryEffects(draft, updated);
    if (card.isCopy) {
      updated = {
        ...updated,
        isToken: true,
        isCopy: false,
      };
    }
  }
  setCard(draft, updated);

  if (to === 'command' && from !== 'command' && isCommander(draft.state, cardId)) {
    draft.state.commanders = draft.state.commanders.map((commander) =>
      commander.cardId === cardId
        ? { ...commander, castCount: commander.castCount + 1 }
        : commander
    );
    pushLog(draft, `${nameOf(draft, cardId)}が統率領域に戻り統率税が上がった。`);
  }

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
    pushLog(draft, 'すべてのパーマネントをアンタップした。');
  }
}

function handleUntapEntry(draft: Draft): void {
  untapAll(draft);
  draft.state.landsPlayedThisTurn = 0;
  draft.state.spellsCastThisTurn = 0;
  draft.state.drawnThisTurn = 0;

  const cards = { ...draft.state.cards };
  let changed = false;

  for (const id of draft.state.zones.battlefield) {
    const card = cards[id];
    if (!card || !typeLineOf(draft, card).includes('Saga')) continue;
    const nextLore = (card.counters.lore ?? 0) + 1;
    cards[id] = {
      ...card,
      counters: {
        ...card.counters,
        lore: nextLore,
      },
    };
    changed = true;
    pushLog(draft, `${nameOf(draft, id)}の章カウンターが${nextLore}になった。`);
  }

  if (changed) {
    draft.state.cards = cards;
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

function applyMill(draft: Draft, count: number): void {
  const requested = Math.max(0, Math.floor(count));
  if (requested <= 0) return;

  const available = draft.state.zones.library.length;
  const milled = Math.min(requested, available);
  const topIds = draft.state.zones.library.slice(0, milled);

  for (const cardId of topIds) {
    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false);
  }

  pushLog(draft, `切削: ライブラリの上から${milled}枚を墓地に置いた。`);
  if (requested > available) {
    draft.warnings.push(
      `ライブラリが${requested}枚に満たないため${milled}枚を切削した。`
    );
  }
}

function applyDiscard(draft: Draft, cardIds: string[]): void {
  let discarded = 0;

  for (const cardId of cardIds) {
    if (!draft.state.cards[cardId]) continue;
    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false);
    discarded += 1;
  }

  if (discarded > 0) {
    pushLog(draft, `${discarded}枚を捨てた。`);
  }
}

function enterPhase(draft: Draft, phase: Phase, drawnHandled: boolean): void {
  draft.state.phase = phase;
  if (phase === 'untap') {
    handleUntapEntry(draft);
  }
  if (phase === 'draw' && !drawnHandled) {
    const drawn = drawCards(draft, 1);
    if (drawn > 0) {
      pushLog(draft, 'カードを1枚引きました。');
    } else {
      draft.warnings.push('ライブラリが空のためドローできません。');
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

function castDestination(typeLine: string): ZoneId {
  if (/Instant|Sorcery/i.test(typeLine)) return 'graveyard';
  return 'battlefield';
}

function applyPlayLand(draft: Draft, cardId: string, entersTapped?: boolean): void {
  const card = requireCard(draft, cardId);
  if (card.zone !== 'hand') {
    throw new EngineError(`土地は手札からのみプレイできます: ${cardId}`);
  }
  if (!typeLineOf(draft, card).includes('Land')) {
    throw new EngineError(`土地ではないカードです: ${cardId}`);
  }

  moveCardInternal(draft, cardId, 'battlefield', 'bottom', false);
  if (entersTapped) {
    const entered = requireCard(draft, cardId);
    setCard(draft, { ...entered, tapped: true });
  }
  draft.state.landsPlayedThisTurn += 1;
  pushLog(draft, `${nameOf(draft, cardId)}を土地としてプレイしました。`);
  if (draft.state.landsPlayedThisTurn >= 2) {
    draft.warnings.push(`このターン${draft.state.landsPlayedThisTurn}枚目の土地です。`);
  }
}

function applyArrangeTop(
  draft: Draft,
  topOrder: string[],
  toBottom: string[],
  toGraveyard: string[]
): void {
  const originalLibrary = draft.state.zones.library.slice();
  const count = topOrder.length + toBottom.length + toGraveyard.length;
  const originalTop = originalLibrary.slice(0, count);
  const provided = [...topOrder, ...toBottom, ...toGraveyard];
  const providedSet = new Set(provided);
  const originalSet = new Set(originalTop);

  const isExactMatch =
    provided.length === count &&
    providedSet.size === count &&
    originalTop.length === count &&
    originalSet.size === count &&
    provided.every((id) => originalSet.has(id));

  if (!isExactMatch) {
    throw new EngineError('arrangeTop の対象がライブラリ先頭N枚と一致しません。');
  }

  for (const cardId of toGraveyard) {
    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false);
  }

  draft.state.zones = {
    ...draft.state.zones,
    library: [...topOrder, ...originalLibrary.slice(count), ...toBottom],
  };
  pushLog(draft, `ライブラリの上から${count}枚を並べ替えました。`);
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
    draft.state.spellsCastThisTurn += 1;
    pushLog(draft, `統率者${name}をキャストしました(支払い: ${payStr})。`);
  } else {
    moveCardInternal(draft, cardId, dest, 'bottom', false);
    draft.state.spellsCastThisTurn += 1;
    pushLog(draft, `${name}をキャストしました(支払い: ${payStr})。`);
  }
}

function nextAbilityId(state: GameState): string {
  let max = 0;
  for (const id of Object.keys(state.cards)) {
    if (!id.startsWith('a')) continue;
    const n = Number.parseInt(id.slice(1), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `a${max + 1}`;
}

function nextCopyId(state: GameState): string {
  let max = 0;
  for (const id of Object.keys(state.cards)) {
    if (!id.startsWith('k')) continue;
    const n = Number.parseInt(id.slice(1), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `k${max + 1}`;
}

function createAbilityObject(
  abilityId: string,
  sourceId: string,
  defId: string,
  kind: AbilityKind
): CardInstance {
  return {
    id: abilityId,
    defId,
    zone: 'stack',
    tapped: false,
    faceIndex: 0,
    faceDown: false,
    counters: {},
    isToken: false,
    isCommander: false,
    enteredTurn: 0,
    isAbility: true,
    sourceId,
    abilityKind: kind,
  };
}

function applyCastToStack(
  draft: Draft,
  cardId: string,
  payment: ManaPool,
  forced: boolean
): void {
  requireCard(draft, cardId);

  const { shortfall } = subtractPayment(draft, payment);
  if (shortfall > 0) {
    const msg = forced
      ? `マナが${shortfall}点不足していますが強行しました。`
      : `マナが${shortfall}点不足(強行)。`;
    draft.warnings.push(msg);
  } else if (forced) {
    draft.warnings.push('マナ不足のまま強行で唱えました。');
  }

  moveCardInternal(draft, cardId, 'stack', 'bottom', false);
  draft.state.spellsCastThisTurn += 1;
  pushLog(draft, `${nameOf(draft, cardId)}を唱えた(スタックへ)。`);
}

function applyAddAbilityToStack(draft: Draft, sourceId: string, kind: AbilityKind): void {
  const source = requireCard(draft, sourceId);
  const abilityId = nextAbilityId(draft.state);
  const cards = { ...draft.state.cards };
  const stack = editZone(draft, 'stack');

  cards[abilityId] = createAbilityObject(abilityId, sourceId, source.defId, kind);
  draft.state.cards = cards;
  stack.push(abilityId);

  pushLog(
    draft,
    `${nameOf(draft, sourceId)}の${ABILITY_KIND_LABELS[kind]}能力をスタックに積んだ。`
  );
}

function defaultStackResolveDestination(draft: Draft, card: CardInstance): ZoneId {
  return castDestination(typeLineOf(draft, card));
}

function applyResolveStackTop(draft: Draft, to?: ZoneId): void {
  const stack = draft.state.zones.stack;
  if (stack.length === 0) return;

  const topId = stack[stack.length - 1];
  const card = requireCard(draft, topId);

  if (card.isAbility) {
    deleteCardFromState(draft, topId);
    pushLog(draft, `${stackNameOf(draft, card)}の能力を解決した。`);
    return;
  }

  const destination = to ?? defaultStackResolveDestination(draft, card);
  moveCardInternal(draft, topId, destination, 'bottom', false);
  pushLog(draft, `${stackNameOf(draft, card)}を解決した(→${ZONE_LABELS[destination]})。`);
}

function applyRemoveStackItem(draft: Draft, id: string, to?: ZoneId): void {
  if (!draft.state.zones.stack.includes(id)) {
    throw new EngineError(`スタックに存在しないカードです: ${id}`);
  }

  const card = requireCard(draft, id);
  if (card.isAbility) {
    deleteCardFromState(draft, id);
    pushLog(draft, `${stackNameOf(draft, card)}の能力を取り除いた。`);
    return;
  }

  const destination = to ?? 'graveyard';
  moveCardInternal(draft, id, destination, 'bottom', false);
  pushLog(draft, `${stackNameOf(draft, card)}を打ち消した(→${ZONE_LABELS[destination]})。`);
}

function applyCopyStackItem(draft: Draft, cardId: string): void {
  if (!draft.state.zones.stack.includes(cardId)) {
    throw new EngineError(`スタックに存在しないカードです: ${cardId}`);
  }

  const source = requireCard(draft, cardId);
  const stack = editZone(draft, 'stack');
  const cards = { ...draft.state.cards };

  if (source.isAbility) {
    const abilityId = nextAbilityId(draft.state);
    cards[abilityId] = createAbilityObject(
      abilityId,
      source.sourceId ?? cardId,
      source.defId,
      source.abilityKind ?? 'activated'
    );
    draft.state.cards = cards;
    stack.push(abilityId);
    pushLog(draft, `${stackNameOf(draft, source)}の能力をコピーした。`);
    return;
  }

  const copyId = nextCopyId(draft.state);
  cards[copyId] = {
    id: copyId,
    defId: source.defId,
    zone: 'stack',
    tapped: false,
    faceIndex: source.faceIndex,
    faceDown: source.faceDown,
    counters: {},
    isToken: false,
    isCommander: false,
    enteredTurn: 0,
    isCopy: true,
  };
  draft.state.cards = cards;
  stack.push(copyId);
  pushLog(draft, `${stackNameOf(draft, source)}をコピーした(スタックへ)。`);
}

function applyCopyPermanent(draft: Draft, cardId: string, quantity: number): void {
  const source = requireCard(draft, cardId);
  const qty = Math.max(0, Math.floor(quantity));
  if (qty === 0) return;

  const genId = nextTokenId(draft.state);
  const cards = { ...draft.state.cards };
  const battlefield = editZone(draft, 'battlefield');

  for (let i = 1; i <= qty; i++) {
    const token = applyBattlefieldEntryEffects(draft, {
      id: genId(i),
      defId: source.defId,
      zone: 'battlefield',
      tapped: false,
      faceIndex: source.faceIndex,
      faceDown: source.faceDown,
      counters: {},
      isToken: true,
      isCommander: false,
      enteredTurn: 0,
    });
    cards[token.id] = token;
    battlefield.push(token.id);
  }

  draft.state.cards = cards;
  pushLog(draft, `${nameOf(draft, cardId)}のコピー・トークンを${qty}個作った。`);
}

// ---------------------------------------------------------------------------
// Treasure / token handling
// ---------------------------------------------------------------------------

function applyCrackTreasure(draft: Draft, cardId: string, color: ManaColor): void {
  const card = requireCard(draft, cardId);
  const def = draft.state.defs[card.defId];
  if (def?.tokenKind !== 'treasure') {
    throw new EngineError(`宝物ではないカードです: ${cardId}`);
  }
  if (card.zone !== 'battlefield') {
    throw new EngineError(`宝物は戦場でのみ割れます: ${cardId}`);
  }

  draft.state.manaPool = {
    ...draft.state.manaPool,
    [color]: draft.state.manaPool[color] + 1,
  };
  moveCardInternal(draft, cardId, 'graveyard', 'top', false);
  pushLog(draft, `${nameOfCard(draft, card)}を割って${color}マナを1点加えました。`);
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
  quantity: number,
  producedMana: ManaColor[] | undefined,
  tokenKind: CardDef['tokenKind']
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
    producedMana,
    tokenKind,
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
    const token = applyBattlefieldEntryEffects(draft, {
      id,
      defId,
      zone: 'battlefield',
      tapped: false,
      faceIndex: 0,
      faceDown: false,
      counters: {},
      isToken: true,
      isCommander: false,
      enteredTurn: 0,
    });
    cards[id] = token;
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
    case 'adjustOpponentLife': {
      const current = draft.state.opponentLife[cmd.label] ?? 40;
      const next = current + cmd.delta;
      draft.state.opponentLife = {
        ...draft.state.opponentLife,
        [cmd.label]: next,
      };
      pushLog(draft, `対戦相手ライフ(${cmd.label})を${next}にしました。`);
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
    case 'adjustMana': {
      if (cmd.delta === 0) break;
      const current = draft.state.manaPool[cmd.color];
      const next = Math.max(0, current + cmd.delta);
      if (next === current) break;
      draft.state.manaPool = {
        ...draft.state.manaPool,
        [cmd.color]: next,
      };
      const deltaLabel = cmd.delta > 0 ? `+${cmd.delta}` : `${cmd.delta}`;
      pushLog(draft, `${cmd.color}マナを${deltaLabel}した(現在${next})。`);
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
      draft.state.drawnThisTurn += drawn;
      pushLog(draft, `カードを${drawn}枚引きました。`);
      if (drawn < cmd.count) {
        draft.warnings.push('ライブラリが足りずすべて引けませんでした。');
      }
      break;
    }
    case 'mill': {
      applyMill(draft, cmd.count);
      break;
    }
    case 'shuffle': {
      applyShuffle(draft, cmd.order);
      break;
    }
    case 'untapAll': {
      untapAll(draft);
      break;
    }
    case 'discard': {
      applyDiscard(draft, cmd.cardIds);
      break;
    }
    case 'putOnBottom': {
      applyPutOnBottom(draft, cmd.cardIds);
      break;
    }
    case 'playLand': {
      applyPlayLand(draft, cmd.cardId, cmd.entersTapped);
      break;
    }
    case 'arrangeTop': {
      applyArrangeTop(draft, cmd.topOrder, cmd.toBottom, cmd.toGraveyard);
      break;
    }
    case 'crackTreasure': {
      applyCrackTreasure(draft, cmd.cardId, cmd.color);
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
    case 'castToStack': {
      applyCastToStack(draft, cmd.cardId, cmd.payment, cmd.forced);
      break;
    }
    case 'addAbilityToStack': {
      applyAddAbilityToStack(draft, cmd.sourceId, cmd.kind);
      break;
    }
    case 'resolveStackTop': {
      applyResolveStackTop(draft, cmd.to);
      break;
    }
    case 'removeStackItem': {
      applyRemoveStackItem(draft, cmd.id, cmd.to);
      break;
    }
    case 'copyStackItem': {
      applyCopyStackItem(draft, cmd.cardId);
      break;
    }
    case 'copyPermanent': {
      applyCopyPermanent(draft, cmd.cardId, cmd.quantity);
      break;
    }
    case 'createToken': {
      applyCreateToken(
        draft,
        cmd.name,
        cmd.typeLine,
        cmd.power,
        cmd.toughness,
        cmd.quantity,
        cmd.producedMana,
        cmd.tokenKind
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
