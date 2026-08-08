import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CURRENT_CONTRACT_VERSIONS,
  validateContractVersionVector,
  type ContractVersionVector,
} from '../../src/versioning/contractVersions';

const PROJECT_ROOT = resolve(process.cwd());
const METADATA_FILE = resolve(
  PROJECT_ROOT,
  'rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json',
);
const RULESET_FIELDS = ['rulesetId', 'effectiveAsOf', 'sha256'] as const;
const VERSION_FIELDS = [
  'contractSchemaVersion',
  'engineSemanticsVersion',
  'stateSchemaVersion',
  'eventSchemaVersion',
  'protocolVersion',
  'projectionSchemaVersion',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isValidVersionNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function isDeepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => isDeepFrozen(child));
}

export function validateCurrentContractAgainstMetadata(metadata: unknown): string[] {
  const errors: string[] = [];
  const currentValidation = validateContractVersionVector(CURRENT_CONTRACT_VERSIONS);
  if (!currentValidation.ok) {
    errors.push(...currentValidation.issues.map(({ code, path }) => `${code}:${path}`));
  }
  if (!isDeepFrozen(CURRENT_CONTRACT_VERSIONS)) {
    errors.push('CURRENT_CONTRACT_VERSIONS is not deeply frozen');
  }

  for (const field of VERSION_FIELDS) {
    if (!isValidVersionNumber(CURRENT_CONTRACT_VERSIONS[field])) {
      errors.push(`invalid current version: ${field}`);
    }
  }

  if (!isRecord(metadata)) {
    errors.push('CR metadata must be a plain object');
    return errors;
  }

  for (const field of RULESET_FIELDS) {
    const metadataValue = metadata[field];
    if (typeof metadataValue !== 'string') {
      errors.push(`CR metadata ${field} must be a string`);
    } else if (metadataValue !== CURRENT_CONTRACT_VERSIONS.ruleset[field]) {
      errors.push(`CR metadata ${field} does not match CURRENT_CONTRACT_VERSIONS`);
    }
  }
  return errors;
}

function readMetadata(): unknown {
  return JSON.parse(readFileSync(METADATA_FILE, 'utf8')) as unknown;
}

function runCli(): void {
  try {
    const errors = validateCurrentContractAgainstMetadata(readMetadata());
    if (errors.length > 0) {
      console.error('Version contract validation failed:');
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
      return;
    }

    const current: ContractVersionVector = CURRENT_CONTRACT_VERSIONS;
    console.log([
      `contractSchemaVersion=${current.contractSchemaVersion}`,
      `rulesetId=${current.ruleset.rulesetId}`,
      `engineSemanticsVersion=${current.engineSemanticsVersion}`,
      `stateSchemaVersion=${current.stateSchemaVersion}`,
      `eventSchemaVersion=${current.eventSchemaVersion}`,
      `protocolVersion=${current.protocolVersion}`,
      `projectionSchemaVersion=${current.projectionSchemaVersion}`,
    ].join(' '));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

const isCli = process.argv[1]?.replaceAll('\\', '/').endsWith('/verify-contract-versions.ts') ?? false;
if (isCli) runCli();
