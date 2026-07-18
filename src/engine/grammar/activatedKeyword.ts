export type KeywordActivationZone = 'battlefield' | 'graveyard' | 'hand' | 'command';

export interface CanonicalKeywordActivation {
  keywordId: string;
  keywordLabel: string;
  keywordCost: string;
  activationZones: readonly KeywordActivationZone[];
  text: string;
}

function symbolsAtEnd(text: string): { prefix: string; cost: string } | null {
  const match = /^(.*?)(\{[^}]+\}(?:\{[^}]+\})*(?:\s+or\s+\{[^}]+\}(?:\{[^}]+\})*)?)$/i.exec(text.trim());
  if (!match?.[2]) return null;
  return { prefix: match[1]?.trim() ?? '', cost: match[2].trim() };
}

function simpleCostKeyword(
  core: string,
  keyword: string,
  keywordId: string,
  keywordLabel: string,
  activationZone: KeywordActivationZone,
  effect: (cost: string) => string,
): CanonicalKeywordActivation[] | null {
  const match = new RegExp(`^${keyword}\\s+(.+?)\\.?$`, 'i').exec(core);
  const cost = match?.[1]?.trim();
  if (!cost) return null;
  return [{
    keywordId,
    keywordLabel,
    keywordCost: cost,
    activationZones: [activationZone],
    text: effect(cost),
  }];
}

/** CR 702の「キーワード [cost]」を通常の起動型能力行へ決定的に展開する。 */
export function canonicalizeActivatedKeyword(core: string): CanonicalKeywordActivation[] | null {
  const text = core.trim();

  const equip = /^equip(?:\s+(.+)|[—―-](.+))\.?$/i.exec(text);
  if (equip) {
    const dashCost = equip[2]?.trim();
    const parsed = dashCost ? { prefix: '', cost: dashCost } : symbolsAtEnd(equip[1] ?? '');
    if (!parsed?.cost) return null;
    const quality = parsed.prefix.toLowerCase();
    const target = quality === 'planeswalker'
      ? 'target planeswalker you control as though that planeswalker were a creature'
      : `target ${quality ? `${quality}${quality.endsWith('creature') ? '' : ' creature'}` : 'creature'} you control`;
    return [{
      keywordId: 'equip', keywordLabel: '装備', keywordCost: parsed.cost, activationZones: ['battlefield'],
      text: `${parsed.cost}: Attach this permanent to ${target}. Activate only as a sorcery.`,
    }];
  }

  const fortify = simpleCostKeyword(text, 'fortify', 'fortify', '城砦化', 'battlefield', (cost) =>
    `${cost}: Attach this Fortification to target land you control. Activate only as a sorcery.`);
  if (fortify) return fortify;

  const levelUp = simpleCostKeyword(text, 'level up', 'level-up', 'Lvアップ', 'battlefield', (cost) =>
    `${cost}: Put a level counter on this permanent. Activate only as a sorcery.`);
  if (levelUp) return levelUp;

  const outlast = simpleCostKeyword(text, 'outlast', 'outlast', '長久', 'battlefield', (cost) =>
    `${cost}, {T}: Put a +1/+1 counter on this creature. Activate only as a sorcery.`);
  if (outlast) return outlast;

  const unearth = simpleCostKeyword(text, 'unearth', 'unearth', '蘇生', 'graveyard', (cost) =>
    `${cost}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step. If it would leave the battlefield, exile it instead of putting it anywhere else. Activate only as a sorcery.`);
  if (unearth) return unearth;

  const embalm = simpleCostKeyword(text, 'embalm', 'embalm', '不朽', 'graveyard', (cost) =>
    `${cost}, Exile this card from your graveyard: Create a token that's a copy of this card, except it's white, it has no mana cost, and it's a Zombie in addition to its other types. Activate only as a sorcery.`);
  if (embalm) return embalm;

  const eternalize = simpleCostKeyword(text, 'eternalize', 'eternalize', '永遠', 'graveyard', (cost) =>
    `${cost}, Exile this card from your graveyard: Create a token that's a copy of this card, except it's black, it's 4/4, it has no mana cost, and it's a Zombie in addition to its other types. Activate only as a sorcery.`);
  if (eternalize) return eternalize;

  const ninjutsuMatch = /^(commander\s+)?ninjutsu\s+(.+?)\.?$/i.exec(text);
  if (ninjutsuMatch?.[2]) {
    const commander = Boolean(ninjutsuMatch[1]);
    return [{
      keywordId: commander ? 'commander-ninjutsu' : 'ninjutsu',
      keywordLabel: commander ? '統率忍術' : '忍術',
      keywordCost: ninjutsuMatch[2].trim(),
      activationZones: commander ? ['hand', 'command'] : ['hand'],
      text: commander
        ? `${ninjutsuMatch[2].trim()}, Reveal this card from your hand or from the command zone, Return an unblocked attacking creature you control to its owner's hand: Put this card onto the battlefield tapped and attacking.`
        : `${ninjutsuMatch[2].trim()}, Reveal this card from your hand, Return an unblocked attacking creature you control to its owner's hand: Put this card onto the battlefield from your hand tapped and attacking.`,
    }];
  }

  const crewMatch = /^crew\s+(\d+|X)\.?$/i.exec(text);
  if (crewMatch?.[1]) {
    return [{
      keywordId: 'crew', keywordLabel: '搭乗', keywordCost: crewMatch[1], activationZones: ['battlefield'],
      text: `Tap any number of other untapped creatures you control with total power ${crewMatch[1]} or greater: This permanent becomes an artifact creature until end of turn.`,
    }];
  }

  const reconfigureMatch = /^reconfigure\s+(.+?)\.?$/i.exec(text);
  if (reconfigureMatch?.[1]) {
    const cost = reconfigureMatch[1].trim();
    return [
      {
        keywordId: 'reconfigure-attach', keywordLabel: '換装', keywordCost: cost, activationZones: ['battlefield'],
        text: `${cost}: Attach this permanent to another target creature you control. Activate only as a sorcery.`,
      },
      {
        keywordId: 'reconfigure-unattach', keywordLabel: '換装解除', keywordCost: cost, activationZones: ['battlefield'],
        text: `${cost}: Unattach this permanent. Activate only if this permanent is attached to a creature and only as a sorcery.`,
      },
    ];
  }

  return null;
}
