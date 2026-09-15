import type { CardDef } from '../types/card';

/** Compare rule inputs, not translated print/art metadata or JSON key order. */
export function sameCockpitCardDefinition(left: CardDef, right: CardDef): boolean {
  const rules = (def: CardDef) => ({
    scryfallId: def.scryfallId,
    oracleId: def.oracleId,
    name: def.name,
    layout: def.layout,
    cmc: def.cmc,
    typeLine: def.typeLine,
    colorIdentity: [...def.colorIdentity].sort(),
    keywords: [...(def.keywords ?? [])].sort(),
    producedMana: [...(def.producedMana ?? [])].sort(),
    tokenKind: def.tokenKind ?? null,
    faces: def.faces.map((face) => ({
      name: face.name,
      manaCost: face.manaCost ?? '',
      typeLine: face.typeLine,
      oracleText: face.oracleText ?? '',
      power: face.power ?? null,
      toughness: face.toughness ?? null,
      loyalty: face.loyalty ?? null,
      defense: face.defense ?? null,
      colors: face.colors ? [...face.colors].sort() : null,
    })),
  });
  return JSON.stringify(rules(left)) === JSON.stringify(rules(right));
}
