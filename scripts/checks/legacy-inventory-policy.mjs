function firstTableCell(line) {
  return line.replace(/^\s*\|/, '').split('|', 1)[0].trim();
}

export const LEGACY_SUGGESTED_DISPOSITIONS = new Set([
  'active-clause',
  'active-acceptance',
  'deferred-needs-decision',
]);

export const LEGACY_JUDGE_DISPOSITIONS = new Set([
  'covered-by',
  'archived-historical',
  'duplicate-of',
  'obsolete-by-explicit-decision',
  'deferred-needs-decision',
]);

export function isTableHeader(line) {
  const firstCell = firstTableCell(line);
  return /^(?:#|id|no\.?|番号|項目|操作|条件|condition)$/i.test(firstCell);
}

export function isNumberedTableRow(line) {
  return /^(?:\d+|[A-Z]\d+)(?:[.)]|$)/i.test(firstTableCell(line));
}

export function isExplicitlyNonNormative(text) {
  return /not cite|引用しない|引用禁止|撤回|withdrawn|withdrawal|retracted|retraction|limitation|scope-out|out of scope|対象外|適用外|範囲外|(?:^|\W)status\s*(?:[:：*]|[-—–])/i.test(text);
}

export function hasExplicitNormativeLanguage(text) {
  return /MUST(?: NOT)?|SHALL|SHOULD|契約|不変|invariant|例外|precondition|完了条件|completion condition|受け入れ|acceptance|合否|pass\/fail|done when|must not/i.test(text);
}

export function isActiveLegacySuggestion(item) {
  if (!['active-clause', 'active-acceptance'].includes(item.suggestedDisposition)) return false;
  if (item.itemType === 'heading' || (item.itemType === 'table-row' && isTableHeader(item.sourceText))) return false;
  if (isExplicitlyNonNormative(item.sourceText)) return false;
  if (item.suggestedDisposition === 'active-acceptance') {
    return isNumberedTableRow(item.sourceText) || hasExplicitNormativeLanguage(item.sourceText);
  }
  return hasExplicitNormativeLanguage(item.sourceText);
}

export function validateLegacyDecision(decision, { baseItemKeys, validTargets }) {
  const errors = [];
  const label = decision?.itemKey ?? '<unknown>';
  if (decision === null || typeof decision !== 'object' || Array.isArray(decision)) return ['decision must be an object'];
  if (typeof decision.itemKey !== 'string' || !baseItemKeys.has(decision.itemKey)) {
    errors.push(`${label}: itemKey does not resolve to current generated base`);
  }
  if (!LEGACY_JUDGE_DISPOSITIONS.has(decision.disposition)) {
    errors.push(`${label}: invalid judge disposition ${decision.disposition}`);
  }
  if (!Array.isArray(decision.targetIds)) errors.push(`${label}: targetIds must be an array`);
  if (typeof decision.rationale !== 'string' || decision.rationale.trim() === '') errors.push(`${label}: rationale is required`);
  if (typeof decision.decisionRef !== 'string' || decision.decisionRef.trim() === '') errors.push(`${label}: decisionRef is required`);

  if (decision.disposition === 'covered-by') {
    if (!Array.isArray(decision.targetIds) || decision.targetIds.length === 0) errors.push(`${label}: covered-by requires targetIds`);
    for (const target of decision.targetIds ?? []) {
      if (!validTargets.has(target)) errors.push(`${label}: unresolved target ${target}`);
    }
  } else if ((decision.targetIds ?? []).length > 0) {
    errors.push(`${label}: targetIds are only valid for covered-by`);
  }

  if (decision.disposition === 'duplicate-of') {
    if (typeof decision.duplicateOfItemKey !== 'string' || !baseItemKeys.has(decision.duplicateOfItemKey)) {
      errors.push(`${label}: duplicateOfItemKey must resolve to current generated base`);
    } else if (decision.duplicateOfItemKey === decision.itemKey) {
      errors.push(`${label}: duplicateOfItemKey must not reference itself`);
    }
  } else if ('duplicateOfItemKey' in decision) {
    errors.push(`${label}: duplicateOfItemKey is only valid for duplicate-of`);
  }
  return errors;
}
