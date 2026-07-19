// CR 207.2c: ability words are italicized labels with no rules meaning.
// Scryfall represents the label inline before an em dash, so grammar entry
// points remove it before interpreting the rules sentence.
const ABILITY_WORD_LABEL_PATTERN = /^\s*[A-Za-z][A-Za-z '-]*\s+(?:\u2014|--|-)\s+/;

export function hasAbilityWordLabel(raw: string): boolean {
  return ABILITY_WORD_LABEL_PATTERN.test(raw);
}

export function stripAbilityWordLabel(raw: string): string {
  return raw.replace(ABILITY_WORD_LABEL_PATTERN, '');
}
