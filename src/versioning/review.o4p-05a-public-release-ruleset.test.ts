import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import * as publicReleaseRulesetModule from './publicReleaseRuleset';
import * as versioningModule from './index';
import {
  CURRENT_CONTRACT_VERSIONS,
  PUBLIC_RELEASE_RULESET_SCHEMA_VERSION_V1,
  PUBLIC_RELEASE_RULESET_V1,
} from './index';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const expectedRuleset = Object.freeze({
  rulesetId: 'mtg-cr-2026-06-19',
  effectiveAsOf: '2026-06-19',
  sha256: 'e99cd70eb64ca854acb6420ebbf06e369e3f258e0cfba4f03f70bd881386f79b',
});

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function isDeepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => isDeepFrozen(child));
}

interface MachineCheckStep {
  readonly name: string;
  readonly cmd: string;
  readonly args: readonly string[];
}

function machineCheckSteps(): readonly MachineCheckStep[] {
  const script = [
    "import { machineCheckStepsFor } from './scripts/checks/machine-checks.mjs';",
    'console.log(JSON.stringify(machineCheckStepsFor()));',
  ].join(' ');
  const output = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  return JSON.parse(output) as MachineCheckStep[];
}

describe('O4P-05A public release ruleset', () => {
  it('publishes only the exact repository-local V1 descriptor', () => {
    expect(PUBLIC_RELEASE_RULESET_SCHEMA_VERSION_V1).toBe(1);
    expect(PUBLIC_RELEASE_RULESET_V1).toEqual({
      kind: 'mtg-onedeck-public-release-ruleset-v1',
      schemaVersion: 1,
      source: 'repository-local-pin',
      contractVersions: CURRENT_CONTRACT_VERSIONS,
    });
    expect(PUBLIC_RELEASE_RULESET_V1.contractVersions).toBe(CURRENT_CONTRACT_VERSIONS);
    expect(isDeepFrozen(PUBLIC_RELEASE_RULESET_V1)).toBe(true);
    expect(Object.keys(publicReleaseRulesetModule).sort()).toEqual([
      'PUBLIC_RELEASE_RULESET_SCHEMA_VERSION_V1',
      'PUBLIC_RELEASE_RULESET_V1',
    ]);
    expect(Object.keys(versioningModule).sort()).toEqual([
      'CURRENT_CONTRACT_VERSIONS',
      'PUBLIC_RELEASE_RULESET_SCHEMA_VERSION_V1',
      'PUBLIC_RELEASE_RULESET_V1',
      'diffContractVersionVectors',
      'validateBuildId',
      'validateContractVersionVector',
    ]);
  });

  it('pins the unchanged local CR bytes and exact metadata', () => {
    const rulesFile = resolve(repositoryRoot, 'rule/Magic_The_Gathering_Comprehensive_Rules.txt');
    const metadataFile = resolve(
      repositoryRoot,
      'rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json',
    );
    const metadata = JSON.parse(readFileSync(metadataFile, 'utf8')) as unknown;

    expect(sha256(readFileSync(rulesFile))).toBe(expectedRuleset.sha256);
    expect(metadata).toEqual({
      object: 'mtg_onedeck_comprehensive_rules_pin',
      ...expectedRuleset,
      sourceUrl: 'https://media.wizards.com/2026/downloads/MagicCompRules%2020260619.txt',
      localFile: 'rule/Magic_The_Gathering_Comprehensive_Rules.txt',
      format: 'txt',
      policy: 'Use the pinned CR as a yardstick. Do not treat corpus/classifier parity as CR conformance unless the relevant rule invariant is covered by a CR-grounded golden case.',
    });
  });

  it('keeps the complete release contract vector at the shipped V1 values', () => {
    expect(CURRENT_CONTRACT_VERSIONS).toEqual({
      contractSchemaVersion: 1,
      ruleset: expectedRuleset,
      engineSemanticsVersion: 1,
      stateSchemaVersion: 1,
      eventSchemaVersion: 1,
      protocolVersion: 1,
      projectionSchemaVersion: 1,
    });
    expect(isDeepFrozen(CURRENT_CONTRACT_VERSIONS)).toBe(true);
  });

  it('keeps both fail-closed pin verifiers and type-checking ahead of tests', () => {
    const steps = machineCheckSteps();
    expect(steps.slice(0, 2)).toEqual([
      { name: 'CR固定版検証', cmd: 'npm', args: ['run', 'verify:cr'] },
      { name: 'バージョン契約検証', cmd: 'npm', args: ['run', 'verify:versions'] },
    ]);
    expect(steps.filter((step) => step.args.join('\0') === 'run\0verify:cr')).toHaveLength(1);
    expect(steps.filter((step) => step.args.join('\0') === 'run\0verify:versions')).toHaveLength(1);

    const testsIndex = steps.findIndex(
      (step) => step.cmd === 'npm' && step.args.length === 1 && step.args[0] === 'test',
    );
    const buildIndex = steps.findIndex(
      (step) => step.cmd === 'npm' && step.args.join('\0') === 'run\0build',
    );

    expect(testsIndex).toBeGreaterThan(1);
    expect(buildIndex).toBeGreaterThan(1);
    expect(buildIndex).toBeLessThan(testsIndex);
  });

  it('keeps the release descriptor deterministic and versioning-local', () => {
    const sourcePath = resolve(repositoryRoot, 'src/versioning/publicReleaseRuleset.ts');
    const indexPath = resolve(repositoryRoot, 'src/versioning/index.ts');
    const sourceBytes = readFileSync(sourcePath);
    const indexBytes = readFileSync(indexPath);
    const source = sourceBytes.toString('utf8');

    expect(sha256(sourceBytes)).toBe(
      'd296b506a53aa8d8a9f9fa0d403cf1b551b7221e37a74cc7bb44719c5dc10192',
    );
    expect(sha256(indexBytes)).toBe(
      'c4ea3dca6625866fefbdadf435e51548e61bf5d07723028b519b88cc23e205e6',
    );
    expect(source).not.toMatch(/fetch\s*\(|WebSocket|XMLHttpRequest|https?:\/\//);
    expect(source).not.toMatch(
      /import\.meta\.env|process\.env|localStorage|sessionStorage|Date\.|Math\.random/,
    );
    expect(source).not.toMatch(/from\s+['"]\.\.\//);
  });
});
