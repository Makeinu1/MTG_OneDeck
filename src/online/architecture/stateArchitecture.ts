import type { GameState } from '../../engine/types';

export type OnlineStateArchitecture =
  'mode-neutral-core-with-solo-facade-and-online-envelope';

export const ONLINE_STATE_ARCHITECTURE: OnlineStateArchitecture =
  'mode-neutral-core-with-solo-facade-and-online-envelope';

export type GameStateFieldDisposition =
  | 'CORE_DIRECT'
  | 'CORE_NORMALIZE'
  | 'SOLO_FACADE'
  | 'BLOCKED_REDESIGN';

export type GameStateFieldReasonCode =
  | 'RULE_SEMANTIC_DIRECT'
  | 'NORMALIZATION_REQUIRED'
  | 'SOLO_COMPATIBILITY_VIEW'
  | 'MULTIPLAYER_REDESIGN_REQUIRED';

export interface GameStateFieldPolicyEntry {
  readonly disposition: GameStateFieldDisposition;
  readonly reasonCode: GameStateFieldReasonCode;
  readonly persistInModeNeutralCore: boolean;
  readonly requiresExplicitFollowUp: boolean;
}

export interface GameStateFieldPolicySummary {
  readonly total: number;
  readonly CORE_DIRECT: number;
  readonly CORE_NORMALIZE: number;
  readonly SOLO_FACADE: number;
  readonly BLOCKED_REDESIGN: number;
}

type GameStateFieldPolicyShape = {
  readonly [K in keyof GameState]-?: GameStateFieldPolicyEntry;
};

const CORE_DIRECT_POLICY_ENTRY = {
  disposition: 'CORE_DIRECT',
  reasonCode: 'RULE_SEMANTIC_DIRECT',
  persistInModeNeutralCore: true,
  requiresExplicitFollowUp: false,
} as const satisfies GameStateFieldPolicyEntry;

const CORE_NORMALIZE_POLICY_ENTRY = {
  disposition: 'CORE_NORMALIZE',
  reasonCode: 'NORMALIZATION_REQUIRED',
  persistInModeNeutralCore: true,
  requiresExplicitFollowUp: true,
} as const satisfies GameStateFieldPolicyEntry;

const SOLO_FACADE_POLICY_ENTRY = {
  disposition: 'SOLO_FACADE',
  reasonCode: 'SOLO_COMPATIBILITY_VIEW',
  persistInModeNeutralCore: false,
  requiresExplicitFollowUp: false,
} as const satisfies GameStateFieldPolicyEntry;

const BLOCKED_REDESIGN_POLICY_ENTRY = {
  disposition: 'BLOCKED_REDESIGN',
  reasonCode: 'MULTIPLAYER_REDESIGN_REQUIRED',
  persistInModeNeutralCore: false,
  requiresExplicitFollowUp: true,
} as const satisfies GameStateFieldPolicyEntry;

const GAME_STATE_FIELD_POLICY_UNFROZEN = {
  effectsAuto: CORE_DIRECT_POLICY_ENTRY,
  activePlayerId: CORE_DIRECT_POLICY_ENTRY,
  turnOrder: CORE_DIRECT_POLICY_ENTRY,
  turn: CORE_DIRECT_POLICY_ENTRY,
  phase: CORE_DIRECT_POLICY_ENTRY,
  emptyLibraryDrawAttemptedSinceLastSba: CORE_DIRECT_POLICY_ENTRY,
  combatDamagePreventedUntilEndOfTurn: CORE_DIRECT_POLICY_ENTRY,
  oncePerTurnTriggerLedger: CORE_DIRECT_POLICY_ENTRY,
  powerUpActivated: CORE_DIRECT_POLICY_ENTRY,

  defs: CORE_NORMALIZE_POLICY_ENTRY,
  cards: CORE_NORMALIZE_POLICY_ENTRY,
  zones: CORE_NORMALIZE_POLICY_ENTRY,
  zonesByPlayer: CORE_NORMALIZE_POLICY_ENTRY,
  players: CORE_NORMALIZE_POLICY_ENTRY,
  eventLog: CORE_NORMALIZE_POLICY_ENTRY,
  pendingTriggers: CORE_NORMALIZE_POLICY_ENTRY,
  pendingRuleChoices: CORE_NORMALIZE_POLICY_ENTRY,
  linkedExiles: CORE_NORMALIZE_POLICY_ENTRY,
  dungeonDefs: CORE_NORMALIZE_POLICY_ENTRY,
  dungeons: CORE_NORMALIZE_POLICY_ENTRY,

  localPlayerId: SOLO_FACADE_POLICY_ENTRY,
  life: SOLO_FACADE_POLICY_ENTRY,
  poison: SOLO_FACADE_POLICY_ENTRY,
  energy: SOLO_FACADE_POLICY_ENTRY,
  experience: SOLO_FACADE_POLICY_ENTRY,
  opponentLife: SOLO_FACADE_POLICY_ENTRY,
  manaPool: SOLO_FACADE_POLICY_ENTRY,
  mulliganCount: SOLO_FACADE_POLICY_ENTRY,
  landsPlayedThisTurn: SOLO_FACADE_POLICY_ENTRY,
  spellsCastThisTurn: SOLO_FACADE_POLICY_ENTRY,
  drawnThisTurn: SOLO_FACADE_POLICY_ENTRY,
  pendingSbaChoices: SOLO_FACADE_POLICY_ENTRY,
  log: SOLO_FACADE_POLICY_ENTRY,

  commanders: BLOCKED_REDESIGN_POLICY_ENTRY,
  combat: BLOCKED_REDESIGN_POLICY_ENTRY,
  commanderDamage: BLOCKED_REDESIGN_POLICY_ENTRY,
  defeat: BLOCKED_REDESIGN_POLICY_ENTRY,
} as const satisfies GameStateFieldPolicyShape;

function isObjectLike(value: unknown): value is object {
  return value !== null && typeof value === 'object';
}

function deepFreeze<T>(value: T): T {
  if (isObjectLike(value) && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      if (isObjectLike(child)) deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

export const GAME_STATE_FIELD_POLICY = deepFreeze(GAME_STATE_FIELD_POLICY_UNFROZEN);

type SummaryAccumulator = {
  total: number;
} & {
  [K in GameStateFieldDisposition]: number;
};

export function summarizeGameStateFieldPolicy(): GameStateFieldPolicySummary {
  const summary: SummaryAccumulator = {
    total: 0,
    CORE_DIRECT: 0,
    CORE_NORMALIZE: 0,
    SOLO_FACADE: 0,
    BLOCKED_REDESIGN: 0,
  };

  for (const entry of Object.values(GAME_STATE_FIELD_POLICY)) {
    summary.total += 1;
    summary[entry.disposition] += 1;
  }

  return Object.freeze(summary);
}
