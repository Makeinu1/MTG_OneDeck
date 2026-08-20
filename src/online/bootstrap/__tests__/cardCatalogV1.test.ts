import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  O4P06A_CARD_CATALOG_V1,
  catalogIssuesV1,
  getO4P06ACardCatalogV1,
  resolveO4P06ACardDefinitionV1,
} from '../index';
import { parseDeckList } from '../../../data/deckParser';

describe('O4P-06A committed card catalog', () => {
  it('contains the frozen 336-name provenance split', () => {
    expect(O4P06A_CARD_CATALOG_V1.entries).toHaveLength(336);
    expect(O4P06A_CARD_CATALOG_V1.entries.filter((entry) => entry.resolution === 'pinned-exact')).toHaveLength(308);
    expect(O4P06A_CARD_CATALOG_V1.entries.filter((entry) => entry.resolution === 'pinned-front-face')).toHaveLength(11);
    expect(O4P06A_CARD_CATALOG_V1.entries.filter((entry) => entry.resolution === 'live-collection')).toHaveLength(17);
    expect(O4P06A_CARD_CATALOG_V1.corpusSavedCards).toBe(17491);
    expect(getO4P06ACardCatalogV1()).toBe(O4P06A_CARD_CATALOG_V1);
    const names = new Set<string>();
    for (const deck of ['Celes', 'Gogo', 'Kefka', 'Muldrotha']) for (const entry of parseDeckList(readFileSync(`Mydeck/${deck}.txt`, 'utf8')).entries) names.add(entry.name);
    expect([...O4P06A_CARD_CATALOG_V1.entries].map((entry) => entry.lookupName)).toEqual([...names].sort());
  });

  it('retains complete modal DFC definitions for front-face and live routes', () => {
    const pathway = resolveO4P06ACardDefinitionV1('Blightstep Pathway');
    expect(pathway?.faces.map((face) => face.name)).toEqual(['Blightstep Pathway', 'Searstep Pathway']);
    const malakir = resolveO4P06ACardDefinitionV1('Malakir Rebirth');
    expect(malakir?.name).toBe('Malakir Rebirth // Malakir Mire');
    expect(malakir?.faces.map((face) => face.name)).toEqual(['Malakir Rebirth', 'Malakir Mire']);
  });

  it('rejects malformed, duplicate, out-of-order, and misrouted catalog entries', () => {
    const malformed = structuredClone(O4P06A_CARD_CATALOG_V1) as unknown as { entries: Array<Record<string, unknown>> };
    malformed.entries[0] = { ...malformed.entries[0], lookupName: malformed.entries[1]?.lookupName };
    expect(catalogIssuesV1(malformed).some((issue) => issue.code === 'CATALOG_DUPLICATE_NAME')).toBe(true);
    const misrouted = structuredClone(O4P06A_CARD_CATALOG_V1) as unknown as { entries: Array<Record<string, unknown>> };
    misrouted.entries[0] = { ...misrouted.entries[0], resolution: 'live-collection' };
    expect(catalogIssuesV1(misrouted).some((issue) => issue.code === 'CATALOG_INVALID_PROVENANCE')).toBe(true);
  });
});
