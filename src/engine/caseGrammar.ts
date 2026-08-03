/**
 * CR 719 Case card section parser.
 *
 * Parses oracle text lines of the form "To solve — [Condition]" (CR 719.3a)
 * and "Solved — [Ability]" (CR 719.3c / 702.169) into structured sections.
 * Em-dash, en-dash, and hyphen separators are all accepted, matching the
 * sagaGrammar/classGrammar dash discipline.
 */

export interface CaseSections {
  /** Condition text after "To solve —" (719.3a); undefined if absent. */
  toSolveCondition?: string;
  /** Ability lines prefixed by "Solved —" (702.169), prefix stripped, in order. */
  solvedAbilities: string[];
}

const TO_SOLVE_LINE_RE = /^to\s+solve\s*[—–-]\s*(.+)$/i;
const SOLVED_LINE_RE = /^solved\s*[—–-]\s*(.*)$/i;

/**
 * Whether a line is a solved-gated ability line, i.e. starts with
 * "Solved —" (em/en/hyphen variants). Used by status.ts Layer 6 static
 * collection to gate such lines behind the solved designation (702.169b).
 */
export function isSolvedGatedLine(line: string): boolean {
  return SOLVED_LINE_RE.test(line.trim());
}

/**
 * Strip the "Solved —" prefix from a solved-gated line, returning the
 * ability text after the dash. Returns null when the line is not
 * solved-gated. Whitespace around the dash and at the edges is trimmed.
 */
export function stripSolvedGatePrefix(line: string): string | null {
  const match = SOLVED_LINE_RE.exec(line.trim());
  if (!match) return null;
  return match[1].trim();
}

/**
 * Parse Case oracle text into sections (CR 719.3).
 *
 * A line matching "To solve — [Condition]" yields toSolveCondition (first
 * match wins; real Cases have exactly one). Each line matching
 * "Solved — [Ability]" is pushed to solvedAbilities with the prefix
 * stripped, in oracle-text order. All other lines are ignored.
 * Empty/missing oracleText → { solvedAbilities: [] }.
 */
export function parseCaseSections(oracleText: string | undefined | null): CaseSections {
  if (!oracleText) return { solvedAbilities: [] };

  const sections: CaseSections = { solvedAbilities: [] };
  for (const rawLine of oracleText.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const toSolve = TO_SOLVE_LINE_RE.exec(line);
    if (toSolve) {
      if (sections.toSolveCondition === undefined) {
        sections.toSolveCondition = toSolve[1].trim();
      }
      continue;
    }

    const stripped = stripSolvedGatePrefix(line);
    if (stripped !== null) {
      sections.solvedAbilities.push(stripped);
    }
  }
  return sections;
}
