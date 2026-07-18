import { removeReminderAndQuotes, splitParagraphs } from '../../engine/keywordGrammar';
import type { ActivatedAbilityLine } from '../../engine/grammar';
import type { CardDef } from '../../types/card';

function normalizedOracleParagraph(text: string): string {
  return removeReminderAndQuotes(text).replace(/\s+/g, ' ').trim();
}

/**
 * Returns the Japanese printed paragraph corresponding to an Oracle-authoritative activated
 * line when the face/paragraph mapping is unambiguous. Parsing and the stable flat index always
 * remain English; this helper is display-only and fails closed to Oracle text.
 */
export function activatedAbilityDisplayText(
  def: CardDef,
  line: ActivatedAbilityLine,
): string {
  const face = def.faces[line.faceIndex];
  if (!face?.oracleText || !face.printedText) return line.text;
  const oracleParagraphs = splitParagraphs(face.oracleText);
  const printedParagraphs = splitParagraphs(face.printedText);
  if (oracleParagraphs.length !== printedParagraphs.length) return line.text;

  const normalizedLine = normalizedOracleParagraph(line.text);
  const matchingIndexes = oracleParagraphs.flatMap((paragraph, index) =>
    normalizedOracleParagraph(paragraph) === normalizedLine ? [index] : [],
  );
  if (matchingIndexes.length !== 1) return line.text;
  const printed = printedParagraphs[matchingIndexes[0]]?.trim();
  if (!printed || (!printed.includes(':') && !printed.includes('：'))) return line.text;
  return printed;
}

