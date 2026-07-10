/**
 * affordability — 手札のプレイ可能ハイライト用のマナ計算 selector(純関数)。
 * docs/design-playbook.md §3 D3(2)。手札のうち「今プレイできる」カードを判定する。
 *
 * 利用可能マナ = マナプール + 戦場の未タップマナ源(各1マナ・producedMana の色から選べる)。
 * カードのコスト(色つきpip + 不特定)を、各源を高々1回使う二部マッチングで賄えるかを判定する。
 * monoHybrid {2/W} は「色 W 1つ OR 不特定2」の選択として engine の solvePayment と同様に
 * バックトラックで両分岐を試す(過小評価=金縁が出ない側の失敗を避ける)。
 * 近似(ハイライト=助言ゆえ強行可): 1源=1マナ(Sol Ring 等の複数マナ源は過小評価=金縁が
 * 出ないことがある。engine の manaProductionAmount は正確だが本 selector は再利用せず将来スライスへ延期)。
 * phyrexian はライフ払い可ゆえマナ要求から除外・X は 0。
 *
 * 純粋性: 同一 state → 同一出力。state を変異しない。
 */

import type { GameState } from '../../engine/types';
import type { ManaColor } from '../../types/card';
import { parseManaCost, type ParsedCost } from '../../engine/mana';

/** 1マナ源が生成しうる色の集合(pool の1マナ=単色集合、土地=producedMana 集合)。 */
export type ManaUnit = ReadonlySet<ManaColor>;

/** GameState から利用可能なマナ源(pool + 未タップ源)を列挙する。 */
export function availableManaUnits(state: GameState): ManaUnit[] {
  const units: ManaUnit[] = [];
  // マナプール: 各色 count 個の単色ユニット。
  (['W', 'U', 'B', 'R', 'G', 'C'] as ManaColor[]).forEach((color) => {
    const n = state.manaPool[color] ?? 0;
    for (let i = 0; i < n; i++) units.push(new Set<ManaColor>([color]));
  });
  // 戦場の未タップマナ源: producedMana を持つ untapped パーマネント。
  for (const cardId of state.zones.battlefield) {
    const card = state.cards[cardId];
    if (!card || card.isAbility || card.tapped) continue;
    const def = state.defs[card.defId];
    const produced = def?.producedMana ?? [];
    if (produced.length > 0) units.push(new Set<ManaColor>(produced));
  }
  return units;
}

function intersects(req: ReadonlySet<ManaColor>, unit: ManaUnit): boolean {
  for (const c of req) if (unit.has(c)) return true;
  return false;
}

/**
 * 色つき要求(各要求=許容色集合)を、各ユニット高々1回で全て満たせるか(Kuhn 二部マッチング)。
 */
function canMatchAll(reqs: ReadonlySet<ManaColor>[], units: ManaUnit[]): boolean {
  const matchUnitToReq: number[] = units.map(() => -1);
  const tryAssign = (r: number, seen: boolean[]): boolean => {
    for (let u = 0; u < units.length; u++) {
      if (seen[u] || !intersects(reqs[r], units[u])) continue;
      seen[u] = true;
      if (matchUnitToReq[u] === -1 || tryAssign(matchUnitToReq[u], seen)) {
        matchUnitToReq[u] = r;
        return true;
      }
    }
    return false;
  };
  for (let r = 0; r < reqs.length; r++) {
    if (!tryAssign(r, units.map(() => false))) return false;
  }
  return true;
}

/** 色つき要求群 + 不特定 を、与えられたマナ源で満たせるか。 */
function feasible(colorReqs: ReadonlySet<ManaColor>[], generic: number, units: ManaUnit[]): boolean {
  if (!canMatchAll(colorReqs, units)) return false;
  return units.length - colorReqs.length >= generic;
}

/** ParsedCost を、与えられたマナ源で支払えるか。 */
export function canAfford(cost: ParsedCost, units: ManaUnit[]): boolean {
  const colorReqs: ReadonlySet<ManaColor>[] = [];
  let generic = cost.generic;
  const monoHybridColors: Exclude<ManaColor, 'C'>[] = [];
  for (const pip of cost.pips) {
    switch (pip.kind) {
      case 'color':
        colorReqs.push(new Set<ManaColor>([pip.color]));
        break;
      case 'colorless':
        colorReqs.push(new Set<ManaColor>(['C']));
        break;
      case 'hybrid':
        colorReqs.push(new Set<ManaColor>(pip.options));
        break;
      case 'monoHybrid':
        monoHybridColors.push(pip.color); // 後段でバックトラック(色 OR 不特定2)。
        break;
      case 'phyrexian':
        break; // ライフ払い可=マナ要求から除外。
      case 'snow':
        generic += 1;
        break;
    }
  }

  // monoHybrid を「その色1つ」または「不特定2」として全組合せ試行(通常0〜1個)。
  const tryMono = (i: number, reqs: ReadonlySet<ManaColor>[], gen: number): boolean => {
    if (i === monoHybridColors.length) return feasible(reqs, gen, units);
    if (tryMono(i + 1, [...reqs, new Set<ManaColor>([monoHybridColors[i]])], gen)) return true;
    return tryMono(i + 1, reqs, gen + 2);
  };
  return tryMono(0, colorReqs, generic);
}

function faceManaCost(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return '';
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  return face?.manaCost ?? '';
}

function faceTypeLine(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return '';
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  return face?.typeLine ?? def?.typeLine ?? '';
}

/**
 * 手札のうち「今プレイできる」カード id の集合。
 * 土地=土地権が残っていればプレイ可。非土地=現在の利用可能マナで唱えられれば可。
 */
export function playableHandCardIds(state: GameState): Set<string> {
  const units = availableManaUnits(state);
  const landDropAvailable = state.landsPlayedThisTurn < 1;
  const playable = new Set<string>();
  for (const cardId of state.zones.hand) {
    const typeLine = faceTypeLine(state, cardId);
    if (typeLine.includes('Land')) {
      if (landDropAvailable) playable.add(cardId);
      continue;
    }
    const cost = parseManaCost(faceManaCost(state, cardId));
    if (canAfford(cost, units)) playable.add(cardId);
  }
  return playable;
}
