import catalogFixture from '../fixtures/o4p-06a-four-deck-card-catalog-v1.json';

import {
  createModeNeutralCoreObjectRegistryStateV2,
  type CoreCardDefinitionSnapshotV1,
  type CoreColorIdentityV1,
  type CoreManaColorV1,
  type CorePlayerId,
} from '../../../engine/core/index';

export type BootstrapCatalogResolutionV1 =
  | 'pinned-exact'
  | 'pinned-front-face'
  | 'live-collection';

export type BootstrapCatalogEntryV1 = Readonly<{
  readonly lookupName: string;
  readonly resolution: BootstrapCatalogResolutionV1;
  readonly definition: CoreCardDefinitionSnapshotV1;
}>;

export type BootstrapCatalogV1 = Readonly<{
  readonly kind: 'o4p-06a-four-deck-card-catalog-v1';
  readonly schemaVersion: 1;
  readonly corpusManifest: Readonly<{
    readonly api: 'https://api.scryfall.com/cards/search';
    readonly query: 'game:paper date>=2021-06-19';
    readonly unique: 'cards';
    readonly includeExtras: false;
    readonly includeMultilingual: false;
    readonly includeVariations: false;
    readonly order: 'name';
  }>;
  readonly corpusSavedCards: 17491;
  readonly entries: readonly BootstrapCatalogEntryV1[];
}>;

export type BootstrapIssueV1 = Readonly<{
  readonly code: string;
  readonly path: string;
  readonly message: string;
}>;

type RawRecord = Record<string, unknown>;

const EXPECTED_MANIFEST = Object.freeze({
  api: 'https://api.scryfall.com/cards/search',
  query: 'game:paper date>=2021-06-19',
  unique: 'cards',
  includeExtras: false,
  includeMultilingual: false,
  includeVariations: false,
  order: 'name',
} as const);

const RESOLUTIONS = new Set<BootstrapCatalogResolutionV1>([
  'pinned-exact',
  'pinned-front-face',
  'live-collection',
]);
const COLORS = new Set<CoreColorIdentityV1>(['W', 'U', 'B', 'R', 'G']);
const PRODUCED = new Set<CoreManaColorV1>(['W', 'U', 'B', 'R', 'G', 'C']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LIVE_LOOKUP_NAMES = new Set([
  'Angelic Renewal', "Blue Sun's Zenith", 'Bounty Agent', 'Capsize', 'Censor',
  'Desecrated Tomb', 'Dispel', 'Emergence Zone', 'Ice Tunnel', 'Jeweled Amulet',
  "Mage's Guile", 'Magosi, the Waterveil', 'Malakir Rebirth', 'Megrim',
  'Scholar of the Lost Trove', 'Whispering Madness', 'Zagoth Triome',
]);

function compare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const delta = left.charCodeAt(index) - right.charCodeAt(index);
    if (delta !== 0) return delta;
  }
  return left.length - right.length;
}

function issue(code: string, path: string, message: string): BootstrapIssueV1 {
  return Object.freeze({ code, path, message });
}

function sortedIssues(issues: readonly BootstrapIssueV1[]): readonly BootstrapIssueV1[] {
  const deduped = new Map<string, BootstrapIssueV1>();
  for (const current of issues) {
    const key = `${current.path}\u0000${current.code}\u0000${current.message}`;
    if (!deduped.has(key)) deduped.set(key, current);
  }
  return Object.freeze([...deduped.values()].sort((left, right) =>
    compare(left.path, right.path) || compare(left.code, right.code) || compare(left.message, right.message),
  ).map((current) => Object.freeze({ ...current })));
}

function plain(value: unknown): value is RawRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function own(value: RawRecord, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor
    ? descriptor.value
    : undefined;
}

function exactKeys(value: RawRecord, keys: readonly string[], path: string, issues: BootstrapIssueV1[]): void {
  const expected = new Set(keys);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !expected.has(key)) issues.push(issue('CATALOG_UNKNOWN_FIELD', `${path}/${String(key)}`, 'Unknown catalog field'));
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) issues.push(issue('CATALOG_MISSING_FIELD', `${path}/${key}`, 'Missing catalog field'));
  }
}

function string(value: unknown): value is string {
  return typeof value === 'string';
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) deepFreeze(descriptor.value, seen);
  }
  return Object.freeze(value);
}

function validateFace(value: unknown, path: string, issues: BootstrapIssueV1[]): boolean {
  if (!plain(value)) {
    issues.push(issue('CATALOG_INVALID_FACE', path, 'Card face must be a plain record'));
    return false;
  }
  const keys = ['name', 'manaCost', 'typeLine', 'oracleText', 'power', 'toughness', 'loyalty', 'defense'] as const;
  exactKeys(value, keys, path, issues);
  const requiredStrings: readonly string[] = ['name', 'typeLine', 'oracleText'];
  for (const key of requiredStrings) if (!string(own(value, key))) issues.push(issue('CATALOG_INVALID_FACE', `${path}/${key}`, 'Face field must be a string'));
  for (const key of ['manaCost', 'power', 'toughness', 'loyalty', 'defense'] as const) {
    const current = own(value, key);
    if (!(current === null || string(current))) issues.push(issue('CATALOG_INVALID_FACE', `${path}/${key}`, 'Nullable face field must be a string or null'));
  }
  return true;
}

function validateDefinition(value: unknown, path: string, issues: BootstrapIssueV1[]): value is CoreCardDefinitionSnapshotV1 {
  const startIssueCount = issues.length;
  if (!plain(value)) {
    issues.push(issue('CATALOG_INVALID_DEFINITION', path, 'Card definition must be a plain record'));
    return false;
  }
  exactKeys(value, ['source', 'name', 'layout', 'manaValue', 'colorIdentity', 'typeLine', 'keywords', 'producedMana', 'tokenKind', 'faces'], path, issues);
  const source = own(value, 'source');
  if (!plain(source)) {
    issues.push(issue('CATALOG_INVALID_SOURCE', `${path}/source`, 'Card source must be a plain record'));
  } else {
    exactKeys(source, ['kind', 'scryfallId', 'oracleId'], `${path}/source`, issues);
    if (own(source, 'kind') !== 'scryfall' || !UUID.test(String(own(source, 'scryfallId'))) || !UUID.test(String(own(source, 'oracleId')))) {
      issues.push(issue('CATALOG_INVALID_SOURCE', `${path}/source`, 'Card source must contain lower-case Scryfall UUIDs'));
    }
  }
  if (!string(own(value, 'name')) || !string(own(value, 'layout')) || !string(own(value, 'typeLine'))) issues.push(issue('CATALOG_INVALID_DEFINITION', path, 'Definition strings are invalid'));
  if (typeof own(value, 'manaValue') !== 'number' || !Number.isFinite(own(value, 'manaValue')) || (own(value, 'manaValue') as number) < 0) issues.push(issue('CATALOG_INVALID_DEFINITION', `${path}/manaValue`, 'Mana value must be a finite non-negative number'));
  const colors = own(value, 'colorIdentity');
  if (!Array.isArray(colors) || colors.some((color) => !string(color) || !COLORS.has(color as CoreColorIdentityV1))) issues.push(issue('CATALOG_INVALID_DEFINITION', `${path}/colorIdentity`, 'Invalid color identity'));
  else {
    const canonical = ['W', 'U', 'B', 'R', 'G'];
    const filtered = colors.filter((color): color is string => typeof color === 'string');
    const rank = (color: string): number => canonical.indexOf(color);
    if (new Set(filtered).size !== filtered.length || filtered.some((color, index) => index > 0 && rank(filtered[index - 1] ?? '') >= rank(color))) issues.push(issue('CATALOG_INVALID_DEFINITION', `${path}/colorIdentity`, 'Color identity must be unique and W/U/B/R/G ordered'));
  }
  const keywords = own(value, 'keywords');
  if (!Array.isArray(keywords) || keywords.some((keyword) => !string(keyword))) issues.push(issue('CATALOG_INVALID_DEFINITION', `${path}/keywords`, 'Invalid keywords'));
  else {
    const values = keywords.filter((keyword): keyword is string => typeof keyword === 'string');
    if (new Set(values).size !== values.length || values.some((keyword, index) => index > 0 && compare(values[index - 1] ?? '', keyword) >= 0)) issues.push(issue('CATALOG_INVALID_DEFINITION', `${path}/keywords`, 'Keywords must be unique and code-unit sorted'));
  }
  const produced = own(value, 'producedMana');
  if (!Array.isArray(produced) || produced.some((color) => !string(color) || !PRODUCED.has(color as CoreManaColorV1))) issues.push(issue('CATALOG_INVALID_DEFINITION', `${path}/producedMana`, 'Invalid produced mana'));
  else {
    const canonical = ['W', 'U', 'B', 'R', 'G', 'C'];
    const values = produced.filter((color): color is string => typeof color === 'string');
    const rank = (color: string): number => canonical.indexOf(color);
    if (new Set(values).size !== values.length || values.some((color, index) => index > 0 && rank(values[index - 1] ?? '') >= rank(color))) issues.push(issue('CATALOG_INVALID_DEFINITION', `${path}/producedMana`, 'Produced mana must be unique and W/U/B/R/G/C ordered'));
  }
  if (own(value, 'tokenKind') !== null) issues.push(issue('CATALOG_INVALID_DEFINITION', `${path}/tokenKind`, 'tokenKind must be null'));
  const faces = own(value, 'faces');
  if (!Array.isArray(faces) || faces.length < 1) issues.push(issue('CATALOG_INVALID_DEFINITION', `${path}/faces`, 'A definition must contain at least one face'));
  else faces.forEach((face, index) => validateFace(face, `${path}/faces/${index}`, issues));
  return issues.length === startIssueCount;
}

function validateCatalog(value: unknown): { readonly ok: true; readonly value: BootstrapCatalogV1 } | { readonly ok: false; readonly issues: readonly BootstrapIssueV1[] } {
  const issues: BootstrapIssueV1[] = [];
  if (!plain(value)) return { ok: false, issues: sortedIssues([issue('CATALOG_INVALID_ROOT', '', 'Catalog must be a plain record')]) };
  exactKeys(value, ['kind', 'schemaVersion', 'corpusManifest', 'corpusSavedCards', 'entries'], '', issues);
  if (own(value, 'kind') !== 'o4p-06a-four-deck-card-catalog-v1') issues.push(issue('CATALOG_INVALID_LITERAL', '/kind', 'Invalid catalog kind'));
  if (own(value, 'schemaVersion') !== 1) issues.push(issue('CATALOG_INVALID_VERSION', '/schemaVersion', 'Invalid catalog schema version'));
  const manifest = own(value, 'corpusManifest');
  if (!plain(manifest)) issues.push(issue('CATALOG_INVALID_MANIFEST', '/corpusManifest', 'Manifest must be a plain record'));
  else {
    exactKeys(manifest, Object.keys(EXPECTED_MANIFEST), '/corpusManifest', issues);
    for (const [key, expected] of Object.entries(EXPECTED_MANIFEST)) if (own(manifest, key) !== expected) issues.push(issue('CATALOG_INVALID_MANIFEST', `/corpusManifest/${key}`, 'Manifest differs from the pinned source'));
  }
  if (own(value, 'corpusSavedCards') !== 17491) issues.push(issue('CATALOG_INVALID_PROVENANCE', '/corpusSavedCards', 'Catalog corpus count must be 17491'));
  const entries = own(value, 'entries');
  if (!Array.isArray(entries)) issues.push(issue('CATALOG_INVALID_ENTRIES', '/entries', 'Catalog entries must be a dense array'));
  const values: BootstrapCatalogEntryV1[] = [];
  if (Array.isArray(entries)) {
    for (let index = 0; index < entries.length; index += 1) if (!Object.prototype.hasOwnProperty.call(entries, index)) issues.push(issue('CATALOG_NON_DENSE_ARRAY', `/entries/${index}`, 'Catalog entries must be dense'));
    const seen = new Set<string>();
    const liveSourceIds = new Set<string>();
    let previous = '';
    entries.forEach((raw, index) => {
      const path = `/entries/${index}`;
      if (!plain(raw)) {
        issues.push(issue('CATALOG_INVALID_ENTRY', path, 'Catalog entry must be a plain record'));
        return;
      }
      exactKeys(raw, ['lookupName', 'resolution', 'definition'], path, issues);
      const lookupName = own(raw, 'lookupName');
      const resolution = own(raw, 'resolution');
      const definition = own(raw, 'definition');
      if (!string(lookupName) || lookupName.length === 0) issues.push(issue('CATALOG_INVALID_ENTRY', `${path}/lookupName`, 'Lookup name must be non-empty'));
      if (!string(resolution) || !RESOLUTIONS.has(resolution as BootstrapCatalogResolutionV1)) issues.push(issue('CATALOG_INVALID_ENTRY', `${path}/resolution`, 'Invalid catalog resolution'));
      if (string(lookupName) && resolution === 'live-collection' && !LIVE_LOOKUP_NAMES.has(lookupName)) issues.push(issue('CATALOG_INVALID_PROVENANCE', `${path}/lookupName`, 'Live-collection lookup is outside the frozen set'));
      if (string(lookupName) && resolution !== 'live-collection' && LIVE_LOOKUP_NAMES.has(lookupName)) issues.push(issue('CATALOG_INVALID_PROVENANCE', `${path}/lookupName`, 'Frozen live-collection lookup has the wrong route'));
      if (resolution === 'pinned-front-face' && plain(definition)) {
        const layout = own(definition, 'layout');
        if (layout !== 'transform' && layout !== 'modal_dfc' && layout !== 'prepare') issues.push(issue('CATALOG_INVALID_PROVENANCE', `${path}/definition/layout`, 'Front-face route requires transform, modal_dfc, or prepare layout'));
        if (layout === 'prepare' && lookupName !== 'Naktamun Lorespinner') issues.push(issue('CATALOG_INVALID_PROVENANCE', `${path}/lookupName`, 'The only prepare route is Naktamun Lorespinner'));
        const faces = own(definition, 'faces');
        if (Array.isArray(faces) && plain(faces[0]) && own(faces[0], 'name') !== lookupName) issues.push(issue('CATALOG_INVALID_PROVENANCE', `${path}/definition/faces/0/name`, 'Front-face lookup must equal face zero name'));
      }
      if (resolution === 'live-collection' && plain(definition)) {
        const source = own(definition, 'source');
        const sourceId = plain(source) ? own(source, 'scryfallId') : null;
        if (typeof sourceId === 'string') {
          if (liveSourceIds.has(sourceId)) issues.push(issue('CATALOG_DUPLICATE_SOURCE_ID', `${path}/definition/source/scryfallId`, 'Live-collection source IDs must be unique'));
          liveSourceIds.add(sourceId);
        }
        if (lookupName === 'Malakir Rebirth') {
          if (sourceId !== '609d3ecf-f88d-4268-a8d3-4bf2bcf5df60' || own(definition, 'name') !== 'Malakir Rebirth // Malakir Mire' || own(definition, 'layout') !== 'modal_dfc') issues.push(issue('CATALOG_INVALID_PROVENANCE', `${path}/definition`, 'Malakir Rebirth must retain its full modal-DFC definition'));
          const faces = own(definition, 'faces');
          if (!Array.isArray(faces) || faces.length !== 2 || !plain(faces[0]) || !plain(faces[1]) || own(faces[0], 'name') !== 'Malakir Rebirth' || own(faces[1], 'name') !== 'Malakir Mire') issues.push(issue('CATALOG_INVALID_PROVENANCE', `${path}/definition/faces`, 'Malakir Rebirth faces must remain ordered and complete'));
        }
      }
      if (string(lookupName)) {
        if (seen.has(lookupName)) issues.push(issue('CATALOG_DUPLICATE_NAME', `${path}/lookupName`, 'Lookup names must be unique'));
        if (index > 0 && compare(previous, lookupName) >= 0) issues.push(issue('CATALOG_INVALID_ORDER', `${path}/lookupName`, 'Lookup names must be code-unit sorted'));
        seen.add(lookupName); previous = lookupName;
      }
      if (validateDefinition(definition, `${path}/definition`, issues) && string(lookupName) && string(resolution)) values.push(Object.freeze({ lookupName, resolution: resolution as BootstrapCatalogResolutionV1, definition }));
    });
    if (entries.length !== 336) issues.push(issue('CATALOG_INVALID_COUNT', '/entries', 'Catalog must contain exactly 336 entries'));
    const counts = values.reduce((result, entry) => result.set(entry.resolution, (result.get(entry.resolution) ?? 0) + 1), new Map<BootstrapCatalogResolutionV1, number>());
    for (const [resolution, expected] of [['pinned-exact', 308], ['pinned-front-face', 11], ['live-collection', 17] ] as const) if (counts.get(resolution) !== expected) issues.push(issue('CATALOG_INVALID_PROVENANCE', '/entries', `Catalog must contain ${expected} ${resolution} entries`));
  }
  if (issues.length > 0) return { ok: false, issues: sortedIssues(issues) };
  const canonical = deepFreeze(Object.freeze({
    kind: 'o4p-06a-four-deck-card-catalog-v1' as const,
    schemaVersion: 1 as const,
    corpusManifest: Object.freeze({ ...EXPECTED_MANIFEST }),
    corpusSavedCards: 17491 as const,
    entries: Object.freeze(values),
  }));
  // The existing Core validator is the authoritative shape check for every definition.
  for (const [index, entry] of canonical.entries.entries()) {
    try {
      const p1 = 'P1' as CorePlayerId;
      createModeNeutralCoreObjectRegistryStateV2({
        players: {
          [p1]: {
            life: 40,
            poison: 0,
            energy: 0,
            experience: 0,
            manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
            mulliganCount: 0,
            landsPlayedThisTurn: 0,
            spellsCastThisTurn: 0,
            drawnThisTurn: 0,
            maximumHandSizeOverride: 'none',
          },
        },
        turnOrder: [p1],
        activePlayerId: p1,
        cardDefinitions: { [entry.definition.source.kind === 'scryfall' ? entry.definition.source.scryfallId : 'invalid']: entry.definition },
        physicalCards: {},
        objects: {},
        zones: { byPlayer: { [p1]: { library: [], hand: [], graveyard: [] } }, shared: { battlefield: [], stack: [], exile: [], command: [] } },
      });
    } catch {
      issues.push(issue('CATALOG_INVALID_CORE_DEFINITION', `/entries/${index}/definition`, 'Definition was rejected by the Core validator'));
    }
  }
  if (issues.length > 0) return { ok: false, issues: sortedIssues(issues) };
  return { ok: true, value: canonical };
}

const validated = validateCatalog(catalogFixture);
if (!validated.ok) throw new Error(`Invalid O4P-06A catalog: ${validated.issues.map((current) => current.path).join(',')}`);

export const O4P06A_CARD_CATALOG_V1: BootstrapCatalogV1 = validated.value;

export function getO4P06ACardCatalogV1(): BootstrapCatalogV1 {
  return O4P06A_CARD_CATALOG_V1;
}

export function resolveO4P06ACardDefinitionV1(lookupName: string): CoreCardDefinitionSnapshotV1 | null {
  const entry = O4P06A_CARD_CATALOG_V1.entries.find((candidate) => candidate.lookupName === lookupName);
  return entry?.definition ?? null;
}

export function catalogIssuesV1(value: unknown): readonly BootstrapIssueV1[] {
  const result = validateCatalog(value);
  return result.ok ? Object.freeze([]) : result.issues;
}
