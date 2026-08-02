/**
 * CR 714 Saga chapter ability parser.
 *
 * Parses oracle text lines of the form "I — effect", "II, III — effect" into
 * structured ChapterAbility records. Roman numerals I–X cover all real Sagas
 * (max observed is VII).
 */

export interface ChapterAbility {
  /** 1-based chapter numbers this ability triggers at (714.2c: "II, III —" → [2,3]) */
  chapters: number[];
  /** Effect text after the em-dash */
  effectText: string;
}

const ROMAN_MAP: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
};

function romanToNumber(roman: string): number | undefined {
  return ROMAN_MAP[roman];
}

/** Convert a number (1–10) back to a Roman numeral for display. */
export function numberToRoman(n: number): string {
  for (const [roman, value] of Object.entries(ROMAN_MAP)) {
    if (value === n) return roman;
  }
  return String(n);
}

const ROMAN_PATTERN = 'I{1,3}|IV|VI{0,3}|IX|X';
const CHAPTER_LINE_RE = new RegExp(
  `^(${ROMAN_PATTERN})(\\s*,\\s*(${ROMAN_PATTERN}))*\\s*[—–-]\\s*(.+)$`,
);

/**
 * Parse Saga oracle text into chapter abilities (CR 714.2b/714.2c).
 *
 * Each line matching the chapter pattern produces one ChapterAbility.
 * Non-matching lines (static text, "This Saga enters…") are ignored.
 * Returns abilities in oracle-text order.
 * Empty/missing oracleText → [].
 */
export function parseSagaChapters(oracleText: string | undefined | null): ChapterAbility[] {
  if (!oracleText) return [];

  const abilities: ChapterAbility[] = [];
  const lines = oracleText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = CHAPTER_LINE_RE.exec(trimmed);
    if (!match) continue;

    // Extract all comma-separated Roman numeral parts before the dash.
    const prefix = trimmed.slice(0, trimmed.search(/[—–-]/));
    const parts = prefix.split(',').map((p) => p.trim());
    const chapters: number[] = [];
    for (const part of parts) {
      const n = romanToNumber(part);
      if (n !== undefined) {
        chapters.push(n);
      }
    }

    if (chapters.length === 0) continue;

    // Effect text is everything after the dash.
    const dashIndex = trimmed.search(/[—–-]/);
    const effectText = trimmed.slice(dashIndex + 1).trim();

    abilities.push({ chapters, effectText });
  }

  return abilities;
}

/**
 * Returns the greatest chapter number across all abilities, or 0 if empty
 * (CR 714.2d: a Saga with no chapter abilities is sacrificed as an SBA).
 */
export function finalChapterNumber(abilities: ChapterAbility[]): number {
  let max = 0;
  for (const ability of abilities) {
    for (const ch of ability.chapters) {
      if (ch > max) max = ch;
    }
  }
  return max;
}
