function firstTableCell(line) {
  return line.replace(/^\s*\|/, '').split('|', 1)[0].trim();
}

export function isTableHeader(line) {
  const firstCell = firstTableCell(line);
  return /^(?:#|id|no\.?|番号|項目|操作|条件|condition)$/i.test(firstCell);
}

export function isNumberedTableRow(line) {
  return /^(?:\d+|[A-Z]\d+)(?:[.)]|$)/i.test(firstTableCell(line));
}

export function isExplicitlyNonNormative(text) {
  return /not cite|引用しない|引用禁止|撤回|withdrawn|retracted|retraction|limitation|scope-out|out of scope|対象外|適用外|範囲外|(?:^|\W)status\s*[:：*]/i.test(text);
}

export function hasExplicitNormativeLanguage(text) {
  return /MUST(?: NOT)?|SHALL|SHOULD|契約|不変|invariant|例外|precondition|完了条件|completion condition|受け入れ|acceptance|合否|pass\/fail|done when|must not/i.test(text);
}

export function isActiveLegacyItem(item) {
  if (!['active-clause', 'active-acceptance', 'covered-by'].includes(item.disposition)) return false;
  if (item.itemType === 'heading' || (item.itemType === 'table-row' && isTableHeader(item.sourceText))) return false;
  if (isExplicitlyNonNormative(item.sourceText)) return false;
  if (item.disposition === 'active-acceptance') {
    return isNumberedTableRow(item.sourceText) || hasExplicitNormativeLanguage(item.sourceText);
  }
  return hasExplicitNormativeLanguage(item.sourceText);
}
