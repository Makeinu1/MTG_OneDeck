import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import { validateCrRuleset } from '../checks/verify-cr-ruleset.mjs';

const VALID_BODY = '\uFEFFMagic: The Gathering Comprehensive Rules\r\n\r\nThese rules are effective as of June 19, 2026.\r\n';
const VALID_METADATA = {
  object: 'mtg_onedeck_comprehensive_rules_pin',
  rulesetId: 'mtg-cr-2026-06-19',
  effectiveAsOf: '2026-06-19',
  sourceUrl: 'https://media.wizards.com/2026/downloads/MagicCompRules%2020260619.txt',
  format: 'txt',
};
const fixtureDirectories = [];

function bodySha256(body) {
  return createHash('sha256').update(Buffer.from(body, 'utf8')).digest('hex');
}

function makeFixture({ body = VALID_BODY, metadata = {} } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'mtg-onedeck-cr-ruleset-'));
  fixtureDirectories.push(directory);
  const rulesFile = join(directory, 'rules.txt');
  const metadataFile = join(directory, 'rules.metadata.json');
  const completeMetadata = {
    ...VALID_METADATA,
    localFile: relative(process.cwd(), rulesFile).split(sep).join('/'),
    sha256: bodySha256(body),
    ...metadata,
  };
  writeFileSync(rulesFile, body, 'utf8');
  writeFileSync(metadataFile, `${JSON.stringify(completeMetadata, null, 2)}\n`, 'utf8');
  return { rulesFile, metadataFile, completeMetadata };
}

afterEach(() => {
  while (fixtureDirectories.length > 0) {
    rmSync(fixtureDirectories.pop(), { recursive: true, force: true });
  }
});

describe('pinned CR ruleset verification', () => {
  it('accepts valid body bytes and metadata', () => {
    const fixture = makeFixture();

    expect(validateCrRuleset(fixture)).toMatchObject({
      computedSha256: fixture.completeMetadata.sha256,
      effectiveAsOf: '2026-06-19',
      format: 'txt',
    });
  });

  it('fails when one body character changes without normalizing bytes', () => {
    const fixture = makeFixture();
    const original = readFileSync(fixture.rulesFile, 'utf8');
    writeFileSync(fixture.rulesFile, original.replace('Magic:', 'Magiс:'), 'utf8');

    expect(() => validateCrRuleset(fixture)).toThrow(/sha256 does not match/);
  });

  it('fails when effectiveAsOf changes', () => {
    const fixture = makeFixture({ metadata: { effectiveAsOf: '2026-06-20' } });

    expect(() => validateCrRuleset(fixture)).toThrow(/rulesetId date does not match effectiveAsOf/);
  });

  it('fails when the rulesetId date changes', () => {
    const fixture = makeFixture({ metadata: { rulesetId: 'mtg-cr-2026-06-20' } });

    expect(() => validateCrRuleset(fixture)).toThrow(/rulesetId date does not match effectiveAsOf/);
  });

  it('fails for an invalid SHA-256 representation', () => {
    const fixture = makeFixture({ metadata: { sha256: 'E99CD70E' } });

    expect(() => validateCrRuleset(fixture)).toThrow(/64 lowercase hexadecimal/);
  });

  it('fails when a metadata field is present more than once', () => {
    const fixture = makeFixture();
    const metadataText = readFileSync(fixture.metadataFile, 'utf8');
    writeFileSync(
      fixture.metadataFile,
      metadataText.replace(
        '  "rulesetId": "mtg-cr-2026-06-19",',
        '  "rulesetId": "mtg-cr-2026-06-19",\n  "rulesetId": "mtg-cr-2026-06-19",',
      ),
      'utf8',
    );

    expect(() => validateCrRuleset(fixture)).toThrow(/duplicate top-level metadata keys/);
  });

  it('fails for a non-official source URL', () => {
    const fixture = makeFixture({ metadata: { sourceUrl: 'https://example.com/rules.txt' } });

    expect(() => validateCrRuleset(fixture)).toThrow(/official HTTPS Wizards domain/);
  });

  it('fails for a different official source URL', () => {
    const fixture = makeFixture({
      metadata: {
        sourceUrl: 'https://media.wizards.com/2026/downloads/MagicCompRules%2020260620.txt',
      },
    });

    expect(() => validateCrRuleset(fixture)).toThrow(/pinned CR source URL/);
  });

  it('fails when localFile does not identify the pinned rules file', () => {
    const fixture = makeFixture({ metadata: { localFile: 'rule/other.txt' } });

    expect(() => validateCrRuleset(fixture)).toThrow(/pinned CR file path/);
  });

  it('fails when the effective date cannot be read from the body header', () => {
    const fixture = makeFixture({ body: '\uFEFFRules without an effective date.\r\n' });

    expect(() => validateCrRuleset(fixture)).toThrow(/Effective日付を取得できません/);
  });
});
