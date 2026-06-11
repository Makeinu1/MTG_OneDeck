export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

export interface CardFace {
  name: string; // English face name
  printedName?: string; // Japanese printed name if resolved
  manaCost?: string; // e.g. "{2}{W/U}"
  typeLine: string;
  printedTypeLine?: string;
  oracleText?: string;
  printedText?: string;
  imageUrl?: string; // display image (ja preferred), Scryfall "normal" size
  power?: string;
  toughness?: string;
  loyalty?: string;
}

export interface CardDef {
  scryfallId: string;
  oracleId: string;
  name: string; // English full name, e.g. "Fable of the Mirror-Breaker // Reflection of Kiki-Jiki"
  printedName?: string;
  lang: 'ja' | 'en'; // language of the resolved print
  layout: string; // 'normal' | 'transform' | 'modal_dfc' | 'adventure' | 'split' | ...
  cmc: number;
  colorIdentity: string[];
  typeLine: string; // English type line of the front face / whole card
  producedMana?: ManaColor[]; // Scryfall produced_mana filtered to WUBRGC
  faces: CardFace[]; // length 1 for normal layout
}
