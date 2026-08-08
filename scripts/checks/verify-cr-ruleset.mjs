#!/usr/bin/env node
// Verify the locally pinned Comprehensive Rules without contacting the network.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJECT_ROOT = resolve(process.cwd());
export const DEFAULT_RULES_FILE = resolve(
  PROJECT_ROOT,
  'rule/Magic_The_Gathering_Comprehensive_Rules.txt',
);
export const DEFAULT_METADATA_FILE = resolve(
  PROJECT_ROOT,
  'rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json',
);
const EXPECTED_METADATA_OBJECT = 'mtg_onedeck_comprehensive_rules_pin';
const EXPECTED_SOURCE_URL = 'https://media.wizards.com/2026/downloads/MagicCompRules%2020260619.txt';

const REQUIRED_METADATA_FIELDS = [
  'object',
  'rulesetId',
  'effectiveAsOf',
  'sourceUrl',
  'localFile',
  'sha256',
  'format',
];
const RULESET_ID_PATTERN = /^mtg-cr-(\d{4}-\d{2}-\d{2})$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const HEADER_DATE_PATTERN = /(?:^|\r?\n)These rules are effective as of ([A-Za-z]+) (\d{1,2}), (\d{4})\./;
const HEADER_SCAN_LIMIT = 4096;
const MONTHS = new Map([
  ['January', 1],
  ['February', 2],
  ['March', 3],
  ['April', 4],
  ['May', 5],
  ['June', 6],
  ['July', 7],
  ['August', 8],
  ['September', 9],
  ['October', 10],
  ['November', 11],
  ['December', 12],
]);

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function topLevelObjectKeys(jsonText) {
  const keys = [];
  let depth = 0;
  let stringStart = -1;
  let escaped = false;

  for (let index = 0; index < jsonText.length; index += 1) {
    const character = jsonText[index];
    if (stringStart !== -1) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        if (depth === 1) {
          let next = index + 1;
          while (/\s/.test(jsonText[next] ?? '')) next += 1;
          if (jsonText[next] === ':') {
            const encodedKey = jsonText.slice(stringStart, index + 1);
            try {
              keys.push(JSON.parse(encodedKey));
            } catch {
              // JSON.parse below reports malformed metadata with a useful error.
            }
          }
        }
        stringStart = -1;
      }
      continue;
    }

    if (character === '"') {
      stringStart = index;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
    }
  }

  return keys;
}

function duplicateKeys(jsonText) {
  const counts = new Map();
  for (const key of topLevelObjectKeys(jsonText)) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
}

function parseMetadata(metadataText, metadataFile) {
  let metadata;
  try {
    metadata = JSON.parse(metadataText);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CrRulesetValidationError([
      `${metadataFile}: invalid JSON (${detail})`,
    ]);
  }

  if (!isRecord(metadata)) {
    throw new CrRulesetValidationError([
      `${metadataFile}: metadata root must be a JSON object`,
    ]);
  }

  const duplicates = duplicateKeys(metadataText);
  if (duplicates.length > 0) {
    throw new CrRulesetValidationError([
      `${metadataFile}: duplicate top-level metadata keys: ${duplicates.join(', ')}`,
    ]);
  }

  return metadata;
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

function readEffectiveDate(rulesText) {
  const match = HEADER_DATE_PATTERN.exec(rulesText.slice(0, HEADER_SCAN_LIMIT));
  if (!match) return null;

  const month = MONTHS.get(match[1]);
  if (month === undefined) return null;

  const year = Number(match[3]);
  const day = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isRegularFile(filePath) {
  return existsSync(filePath) && statSync(filePath).isFile();
}

export class CrRulesetValidationError extends Error {
  constructor(errors) {
    super(`CR ruleset validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    this.name = 'CrRulesetValidationError';
    this.errors = errors;
  }
}

export function validateCrRuleset({
  rulesFile = DEFAULT_RULES_FILE,
  metadataFile = DEFAULT_METADATA_FILE,
} = {}) {
  const resolvedRulesFile = resolve(rulesFile);
  const resolvedMetadataFile = resolve(metadataFile);
  const errors = [];

  if (!isRegularFile(resolvedRulesFile)) {
    errors.push(`${resolvedRulesFile}: CR本文ファイルが存在しないか通常ファイルではありません`);
  }
  if (!isRegularFile(resolvedMetadataFile)) {
    errors.push(`${resolvedMetadataFile}: メタデータファイルが存在しないか通常ファイルではありません`);
  }
  if (errors.length > 0) throw new CrRulesetValidationError(errors);

  const metadataText = readFileSync(resolvedMetadataFile, 'utf8');
  const metadata = parseMetadata(metadataText, resolvedMetadataFile);
  const rulesBytes = readFileSync(resolvedRulesFile);
  const rulesText = rulesBytes.toString('utf8');
  const computedSha256 = sha256(rulesBytes);
  const headerEffectiveAsOf = readEffectiveDate(rulesText);

  for (const field of REQUIRED_METADATA_FIELDS) {
    if (!Object.hasOwn(metadata, field)) {
      errors.push(`${resolvedMetadataFile}: missing required metadata field ${field}`);
    } else if (typeof metadata[field] !== 'string') {
      errors.push(`${resolvedMetadataFile}: metadata field ${field} must be a string`);
    }
  }

  const rulesetId = metadata.rulesetId;
  const effectiveAsOf = metadata.effectiveAsOf;
  const sourceUrl = metadata.sourceUrl;
  const localFile = metadata.localFile;
  const expectedSha256 = metadata.sha256;
  const format = metadata.format;

  if (metadata.object !== EXPECTED_METADATA_OBJECT) {
    errors.push(`${resolvedMetadataFile}: object must identify the pinned MTG ruleset metadata`);
  }

  const rulesetMatch = typeof rulesetId === 'string'
    ? RULESET_ID_PATTERN.exec(rulesetId)
    : null;
  if (!rulesetMatch) {
    errors.push(`${resolvedMetadataFile}: rulesetId must match mtg-cr-YYYY-MM-DD`);
  } else if (!isValidDate(rulesetMatch[1])) {
    errors.push(`${resolvedMetadataFile}: rulesetId contains an invalid calendar date`);
  }

  if (typeof effectiveAsOf !== 'string' || !isValidDate(effectiveAsOf)) {
    errors.push(`${resolvedMetadataFile}: effectiveAsOf must be a valid YYYY-MM-DD date`);
  }
  if (rulesetMatch && typeof effectiveAsOf === 'string' && rulesetMatch[1] !== effectiveAsOf) {
    errors.push(`${resolvedMetadataFile}: rulesetId date does not match effectiveAsOf`);
  }

  if (typeof expectedSha256 !== 'string' || !SHA256_PATTERN.test(expectedSha256)) {
    errors.push(`${resolvedMetadataFile}: sha256 must be 64 lowercase hexadecimal characters`);
  } else if (expectedSha256 !== computedSha256) {
    errors.push(
      `${resolvedMetadataFile}: sha256 does not match CR本文 (${expectedSha256} !== ${computedSha256})`,
    );
  }

  if (typeof headerEffectiveAsOf !== 'string') {
    errors.push(`${resolvedRulesFile}: CR本文冒頭からEffective日付を取得できません`);
  } else if (typeof effectiveAsOf === 'string' && headerEffectiveAsOf !== effectiveAsOf) {
    errors.push(`${resolvedRulesFile}: CR本文のEffective日付がeffectiveAsOfと一致しません`);
  }

  if (typeof sourceUrl !== 'string') {
    errors.push(`${resolvedMetadataFile}: sourceUrl must be a URL string`);
  } else {
    try {
      const url = new URL(sourceUrl);
      const hostname = url.hostname.toLowerCase();
      const officialHost = hostname === 'wizards.com' || hostname.endsWith('.wizards.com');
      if (url.protocol !== 'https:' || !officialHost) {
        errors.push(`${resolvedMetadataFile}: sourceUrl must use the official HTTPS Wizards domain`);
      } else if (sourceUrl !== EXPECTED_SOURCE_URL) {
        errors.push(`${resolvedMetadataFile}: sourceUrl must match the pinned CR source URL`);
      }
    } catch {
      errors.push(`${resolvedMetadataFile}: sourceUrl is not a valid URL`);
    }
  }

  const expectedLocalFile = relative(PROJECT_ROOT, resolvedRulesFile).split(sep).join('/');
  if (typeof localFile === 'string' && localFile !== expectedLocalFile) {
    errors.push(`${resolvedMetadataFile}: localFile must match the pinned CR file path`);
  }

  const actualFormat = extname(resolvedRulesFile).slice(1).toLowerCase();
  if (typeof format !== 'string' || format !== actualFormat) {
    errors.push(
      `${resolvedMetadataFile}: format must match the CR本文 file format (${actualFormat})`,
    );
  }

  if (errors.length > 0) throw new CrRulesetValidationError(errors);

  return {
    rulesFile: resolvedRulesFile,
    metadataFile: resolvedMetadataFile,
    computedSha256,
    effectiveAsOf: headerEffectiveAsOf,
    format: actualFormat,
  };
}

function runCli() {
  try {
    const result = validateCrRuleset();
    console.log(`PASS: pinned CR ${result.effectiveAsOf} sha256=${result.computedSha256}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

const isCli = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isCli) runCli();
