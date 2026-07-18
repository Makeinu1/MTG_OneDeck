import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const draftDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(draftDir, '..', 'cr-backbone-ledger.json');
const proposedPath = path.join(draftDir, 'cr-backbone-ledger.proposed.json');
const historyPath = path.join(draftDir, 'cr-backbone-ledger-history.proposed.json');

const results = [];
const record = (label, pass, detail) => results.push({ label, pass, detail });

function parseJson(label, filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const value = JSON.parse(text);
    record(`(d) ${label} is valid JSON`, true, `${Buffer.byteLength(text)} bytes`);
    return { text, value };
  } catch (error) {
    record(`(d) ${label} is valid JSON`, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

const sourceFile = parseJson('source ledger', sourcePath);
const proposedFile = parseJson('proposed ledger', proposedPath);
const historyFile = parseJson('history ledger', historyPath);

if (sourceFile && proposedFile && historyFile) {
  const source = sourceFile.value;
  const proposed = proposedFile.value;
  const history = historyFile.value;

  const sourceDomainOrder = source.domains.map((domain) => domain.id);
  const proposedDomainOrder = proposed.domains.map((domain) => domain.id);
  const sourceSequenceOrder = source.plannedSequence.map((entry) => entry.domainId);
  const proposedSequenceOrder = proposed.plannedSequence.map((entry) => entry.domainId);

  record(
    '(a) domains count and order match source',
    JSON.stringify(sourceDomainOrder) === JSON.stringify(proposedDomainOrder),
    `${sourceDomainOrder.length} domains`,
  );
  record(
    '(a) plannedSequence count and order match source',
    JSON.stringify(sourceSequenceOrder) === JSON.stringify(proposedSequenceOrder),
    `${sourceSequenceOrder.length} entries`,
  );

  const allowedChanges = new Map();

  for (const field of ['plannedSequenceProvenance', 'selectionRule']) {
    const fullField = `${field}Full`;
    if (typeof history[fullField] === 'string') {
      allowedChanges.set(field, history[fullField]);
    }
  }

  for (const [domainId, fields] of Object.entries(history.domains ?? {})) {
    const index = source.domains.findIndex((domain) => domain.id === domainId);
    for (const [fullField, fullValue] of Object.entries(fields)) {
      if (!fullField.endsWith('Full')) continue;
      const field = fullField.slice(0, -4);
      allowedChanges.set(`domains.${index}.${field}`, fullValue);
    }
  }

  for (const [sequenceKey, fields] of Object.entries(history.plannedSequence ?? {})) {
    const match = /^(\d+)-(.*)$/u.exec(sequenceKey);
    if (!match) continue;
    const index = Number(match[1]);
    const domainId = match[2];
    if (source.plannedSequence[index]?.domainId !== domainId) continue;
    for (const [fullField, fullValue] of Object.entries(fields)) {
      if (!fullField.endsWith('Full')) continue;
      const field = fullField.slice(0, -4);
      allowedChanges.set(`plannedSequence.${index}.${field}`, fullValue);
    }
  }

  const historyStrings = [];
  function collectStrings(value) {
    if (typeof value === 'string') historyStrings.push(value);
    else if (Array.isArray(value)) value.forEach(collectStrings);
    else if (value && typeof value === 'object') Object.values(value).forEach(collectStrings);
  }
  collectStrings(history);

  const mismatches = [];
  const changedProse = [];

  function compare(sourceValue, proposedValue, pathParts = []) {
    const currentPath = pathParts.join('.');
    if (allowedChanges.has(currentPath)) {
      const fullValue = allowedChanges.get(currentPath);
      const exactHistoryMatch = fullValue === sourceValue;
      const isShorter = typeof proposedValue === 'string'
        && typeof sourceValue === 'string'
        && proposedValue.length < sourceValue.length;
      const verbatimInHistory = typeof sourceValue === 'string'
        && historyStrings.some((value) => value.includes(sourceValue));
      changedProse.push({ currentPath, exactHistoryMatch, isShorter, verbatimInHistory });
      return;
    }

    if (JSON.stringify(sourceValue) === JSON.stringify(proposedValue)) return;

    if (
      sourceValue && proposedValue
      && typeof sourceValue === 'object'
      && typeof proposedValue === 'object'
      && Array.isArray(sourceValue) === Array.isArray(proposedValue)
    ) {
      const sourceKeys = Object.keys(sourceValue);
      const proposedKeys = Object.keys(proposedValue);
      if (JSON.stringify(sourceKeys) !== JSON.stringify(proposedKeys)) {
        mismatches.push(`${currentPath || '<root>'}: key set/order differs`);
        return;
      }
      for (const key of sourceKeys) compare(sourceValue[key], proposedValue[key], [...pathParts, key]);
      return;
    }

    mismatches.push(`${currentPath || '<root>'}: unapproved byte change`);
  }

  compare(source, proposed);

  const mappedPaths = new Set(changedProse.map(({ currentPath }) => currentPath));
  const orphanHistoryPaths = [...allowedChanges.keys()].filter((item) => !mappedPaths.has(item));
  const badHistory = changedProse.filter(
    ({ exactHistoryMatch, isShorter, verbatimInHistory }) => !exactHistoryMatch || !isShorter || !verbatimInHistory,
  );

  const unchangedProjection = structuredClone(source);
  for (const changePath of allowedChanges.keys()) {
    const parts = changePath.split('.');
    let cursor = unchangedProjection;
    for (const part of parts.slice(0, -1)) cursor = cursor[part];
    cursor[parts.at(-1)] = '<PRUNED-PROSE>';
  }
  const proposedProjection = structuredClone(proposed);
  for (const changePath of allowedChanges.keys()) {
    const parts = changePath.split('.');
    let cursor = proposedProjection;
    for (const part of parts.slice(0, -1)) cursor = cursor[part];
    cursor[parts.at(-1)] = '<PRUNED-PROSE>';
  }
  const sourceProjectionBytes = JSON.stringify(unchangedProjection);
  const proposedProjectionBytes = JSON.stringify(proposedProjection);
  const projectionHash = crypto.createHash('sha256').update(sourceProjectionBytes).digest('hex');

  record(
    '(b) every non-pruned field is byte-identical',
    mismatches.length === 0 && sourceProjectionBytes === proposedProjectionBytes,
    mismatches.length === 0
      ? `SHA-256 ${projectionHash}`
      : mismatches.slice(0, 5).join('; '),
  );
  record(
    '(c) every shortened prose value is preserved verbatim in history',
    changedProse.length > 0 && badHistory.length === 0 && orphanHistoryPaths.length === 0,
    `${changedProse.length} shortened fields; ${badHistory.length} bad mappings; ${orphanHistoryPaths.length} orphan mappings`,
  );
  record(
    '(c) history note identifies diet date and current source of truth',
    typeof history.note === 'string'
      && history.note.startsWith('2026-07-18 の台帳ダイエットで退避・現在状態の正本は cr-backbone-ledger.json'),
    history.note ?? '<missing>',
  );
}

for (const { label, pass, detail } of results) {
  process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${label} — ${detail}\n`);
}

const failures = results.filter(({ pass }) => !pass);
process.stdout.write(`${failures.length === 0 ? 'ALL PASS' : `${failures.length} CHECK(S) FAILED`}\n`);
if (failures.length > 0) process.exitCode = 1;
