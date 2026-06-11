import type { CardDef } from '../types/card';

export type ZoneId = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command';

export type Phase = 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end';

export const PHASE_ORDER: Phase[] = [
  'untap',
  'upkeep',
  'draw',
  'main1',
  'combat',
  'main2',
  'end',
];

export interface ManaPool {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number;
}

export interface CardInstance {
  id: string; // instance id ('c1', 'c2', ... / tokens: 't1', ...)
  defId: string; // CardDef.scryfallId(トークンは合成defを defs に登録)
  zone: ZoneId;
  tapped: boolean;
  faceIndex: number; // 表示中フェイス(両面カード用。通常カードは常に0)
  faceDown: boolean;
  counters: Record<string, number>; // '+1/+1', 'loyalty', 'charge' など。値は常に >= 0
  isToken: boolean;
  isCommander: boolean;
  attachedTo?: string; // 装備/オーラの付与先 instance id
}

export interface CommanderInfo {
  cardId: string; // CardInstance.id
  castCount: number; // 統率領域からキャストした回数。税 = 2 * castCount
}

export interface LogEntry {
  seq: number;
  turn: number;
  phase: Phase;
  message: string; // 日本語。カード名は printedName ?? name を《》で囲む
}

export interface GameState {
  defs: Record<string, CardDef>; // defId -> CardDef(ゲーム中不変、トークンdef追加のみ)
  cards: Record<string, CardInstance>;
  zones: Record<ZoneId, string[]>; // 順序付き。library[0] = ライブラリの一番上
  commanders: CommanderInfo[]; // 1〜2体(共闘)
  turn: number; // 1始まり
  phase: Phase;
  life: number; // 初期40
  poison: number;
  energy: number;
  experience: number;
  commanderDamage: Record<string, number>; // key: 対戦相手統率者のラベル(自由文字列)
  manaPool: ManaPool;
  mulliganCount: number;
  log: LogEntry[];
}
