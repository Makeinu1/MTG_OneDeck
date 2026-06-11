export interface DeckEntry {
  quantity: number;
  name: string;
  section: 'commander' | 'main';
  line: number;
}

export interface ParseError {
  line: number;
  text: string;
  reason: string;
}

export interface ParsedDeck {
  entries: DeckEntry[];
  errors: ParseError[];
}

// Section header keywords (case-insensitive for ASCII, exact for Japanese).
// Trailing ':' is optional and stripped before matching.
const COMMANDER_HEADERS = new Set(['commander', '統率者']);
const MAIN_HEADERS = new Set(['deck', 'デッキ', 'mainboard']);
const SIDEBOARD_HEADERS = new Set(['sideboard', 'サイドボード']);

const FULLWIDTH_DIGIT_OFFSET = '０'.codePointAt(0)! - '0'.codePointAt(0)!;

/**
 * Normalize full-width digits and full-width spaces to their ASCII equivalents,
 * then trim leading/trailing whitespace.
 */
function normalizeLine(rawLine: string): string {
  let normalized = '';
  for (const ch of rawLine) {
    const codePoint = ch.codePointAt(0)!;
    if (codePoint >= '０'.codePointAt(0)! && codePoint <= '９'.codePointAt(0)!) {
      // Full-width digit -> ASCII digit
      normalized += String.fromCodePoint(codePoint - FULLWIDTH_DIGIT_OFFSET);
    } else if (ch === '　') {
      // Full-width space -> ASCII space
      normalized += ' ';
    } else {
      normalized += ch;
    }
  }
  return normalized.trim();
}

/**
 * Strip a trailing ':' (ASCII or full-width) from a header candidate and
 * lower-case it for comparison against ASCII header keywords.
 */
function normalizeHeaderCandidate(text: string): string {
  return text.replace(/[:：]\s*$/, '').trim();
}

function matchesHeaderSet(candidate: string, headers: Set<string>): boolean {
  const stripped = normalizeHeaderCandidate(candidate);
  if (headers.has(stripped)) {
    return true;
  }
  return headers.has(stripped.toLowerCase());
}

// Matches: optional leading quantity ("1", "1x", "4x") followed by a card name.
// Quantity and name are separated by whitespace.
const QUANTITY_PREFIX_RE = /^(\d+)\s*[xX]?\s+(.+)$/;
// Matches a bare quantity with no name (e.g. just "4" or "4x").
const QUANTITY_ONLY_RE = /^(\d+)\s*[xX]?$/;

export function parseDeckList(text: string): ParsedDeck {
  const entries: DeckEntry[] = [];
  const errors: ParseError[] = [];

  let currentSection: 'commander' | 'main' = 'main';
  let inSideboardSection = false;

  const rawLines = text.split(/\r\n|\r|\n/);

  for (let i = 0; i < rawLines.length; i++) {
    const lineNumber = i + 1;
    const rawLine = rawLines[i];
    const normalized = normalizeLine(rawLine);

    if (normalized === '') {
      continue;
    }

    // Comment lines: leading '#' or leading '//'
    if (normalized.startsWith('#') || normalized.startsWith('//')) {
      continue;
    }

    // Sideboard line prefix: "SB: <name>"
    if (/^SB:\s*/i.test(normalized)) {
      errors.push({
        line: lineNumber,
        text: rawLine,
        reason: 'Sideboard entries are not supported in EDH (single-deck format)',
      });
      continue;
    }

    // Section headers (the whole line, after stripping a trailing ':', matches a known header)
    if (matchesHeaderSet(normalized, COMMANDER_HEADERS)) {
      currentSection = 'commander';
      inSideboardSection = false;
      continue;
    }
    if (matchesHeaderSet(normalized, MAIN_HEADERS)) {
      currentSection = 'main';
      inSideboardSection = false;
      continue;
    }
    if (matchesHeaderSet(normalized, SIDEBOARD_HEADERS)) {
      inSideboardSection = true;
      continue;
    }

    if (inSideboardSection) {
      errors.push({
        line: lineNumber,
        text: rawLine,
        reason: 'Sideboard entries are not supported in EDH (single-deck format)',
      });
      continue;
    }

    // "<quantity> <name>" or "<quantity>x <name>"
    const match = QUANTITY_PREFIX_RE.exec(normalized);
    if (match) {
      const quantity = Number.parseInt(match[1], 10);
      const name = match[2].trim();
      if (name === '') {
        errors.push({
          line: lineNumber,
          text: rawLine,
          reason: 'Missing card name',
        });
        continue;
      }
      entries.push({
        quantity,
        name,
        section: currentSection,
        line: lineNumber,
      });
      continue;
    }

    // A bare quantity with no card name
    if (QUANTITY_ONLY_RE.test(normalized)) {
      errors.push({
        line: lineNumber,
        text: rawLine,
        reason: 'Missing card name',
      });
      continue;
    }

    // No quantity prefix found -> unparseable line
    errors.push({
      line: lineNumber,
      text: rawLine,
      reason: 'Missing quantity prefix (expected "<n> <card name>")',
    });
  }

  return { entries, errors };
}
