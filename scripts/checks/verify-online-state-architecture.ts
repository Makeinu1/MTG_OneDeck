import {
  GAME_STATE_FIELD_POLICY,
  ONLINE_STATE_ARCHITECTURE,
  summarizeGameStateFieldPolicy,
  type GameStateFieldDisposition,
  type GameStateFieldPolicyEntry,
} from '../../src/online/architecture/stateArchitecture';

const EXPECTED_ARCHITECTURE = 'mode-neutral-core-with-solo-facade-and-online-envelope';
const EXPECTED_FIELD_COUNT = 37;
const EXPECTED_COUNTS = {
  CORE_DIRECT: 9,
  CORE_NORMALIZE: 11,
  SOLO_FACADE: 13,
  BLOCKED_REDESIGN: 4,
} as const satisfies { readonly [K in GameStateFieldDisposition]: number };

const EXPECTED_ENTRY_BY_DISPOSITION = {
  CORE_DIRECT: {
    reasonCode: 'RULE_SEMANTIC_DIRECT',
    persistInModeNeutralCore: true,
    requiresExplicitFollowUp: false,
  },
  CORE_NORMALIZE: {
    reasonCode: 'NORMALIZATION_REQUIRED',
    persistInModeNeutralCore: true,
    requiresExplicitFollowUp: true,
  },
  SOLO_FACADE: {
    reasonCode: 'SOLO_COMPATIBILITY_VIEW',
    persistInModeNeutralCore: false,
    requiresExplicitFollowUp: false,
  },
  BLOCKED_REDESIGN: {
    reasonCode: 'MULTIPLAYER_REDESIGN_REQUIRED',
    persistInModeNeutralCore: false,
    requiresExplicitFollowUp: true,
  },
} as const satisfies {
  readonly [K in GameStateFieldDisposition]: Pick<
    GameStateFieldPolicyEntry,
    'reasonCode' | 'persistInModeNeutralCore' | 'requiresExplicitFollowUp'
  >;
};

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isDeepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozen);
}

function runValidation(): void {
  assertCondition(ONLINE_STATE_ARCHITECTURE === EXPECTED_ARCHITECTURE, 'architecture literal mismatch');

  const fields = Object.keys(GAME_STATE_FIELD_POLICY);
  assertCondition(fields.length === EXPECTED_FIELD_COUNT, `expected ${EXPECTED_FIELD_COUNT} fields, got ${fields.length}`);
  assertCondition(isDeepFrozen(GAME_STATE_FIELD_POLICY), 'policy is not deeply frozen');

  const summary = summarizeGameStateFieldPolicy();
  assertCondition(isDeepFrozen(summary), 'summary is not frozen');
  assertCondition(summary.total === EXPECTED_FIELD_COUNT, 'summary total mismatch');
  for (const disposition of Object.keys(EXPECTED_COUNTS) as GameStateFieldDisposition[]) {
    assertCondition(
      summary[disposition] === EXPECTED_COUNTS[disposition],
      `${disposition} count mismatch`,
    );
  }
  assertCondition(summary.BLOCKED_REDESIGN > 0, 'BLOCKED_REDESIGN must not be empty');

  for (const [field, entry] of Object.entries(GAME_STATE_FIELD_POLICY)) {
    const expected = EXPECTED_ENTRY_BY_DISPOSITION[entry.disposition];
    assertCondition(
      entry.reasonCode === expected.reasonCode
        && entry.persistInModeNeutralCore === expected.persistInModeNeutralCore
        && entry.requiresExplicitFollowUp === expected.requiresExplicitFollowUp,
      `${field} has an invalid policy combination`,
    );
  }
}

try {
  runValidation();
  const summary = summarizeGameStateFieldPolicy();
  console.log([
    `architecture=${ONLINE_STATE_ARCHITECTURE}`,
    `fields=${summary.total}`,
    `coreDirect=${summary.CORE_DIRECT}`,
    `coreNormalize=${summary.CORE_NORMALIZE}`,
    `soloFacade=${summary.SOLO_FACADE}`,
    `blockedRedesign=${summary.BLOCKED_REDESIGN}`,
  ].join(' '));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
