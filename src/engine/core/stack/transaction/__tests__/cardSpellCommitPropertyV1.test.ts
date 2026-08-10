import { describe, expect, it } from 'vitest';
import { commitCoreCardSpellToStackV1 } from '../cardSpellCommitV1';
import { validateCoreStackTransactionBundleV1 } from '../stackTransactionBundleV1';
import type { CorePlayerId } from '../../../ids';

const P1 = 'p1' as CorePlayerId;
const P2 = 'p2' as CorePlayerId;

function player(): Record<string, unknown> {
  return { life: 40, poison: 0, energy: 0, experience: 0, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, mulliganCount: 0, landsPlayedThisTurn: 0, spellsCastThisTurn: 0, drawnThisTurn: 0, maximumHandSizeOverride: 'none' };
}

function makeBundle(zone: 'library' | 'hand' | 'graveyard' | 'battlefield' | 'exile' | 'command') {
  const byPlayer = { p1: { library: [], hand: [], graveyard: [] }, p2: { library: [], hand: [], graveyard: [] } } as Record<string, Record<string, string[]>>;
  const shared = { battlefield: [], stack: [], exile: [], command: [] } as Record<string, string[]>;
  if (zone in byPlayer.p1) byPlayer.p1[zone].push('pc:0');
  else shared[zone].push('pc:0');
  const result = validateCoreStackTransactionBundleV1({
    objectRegistry: {
      kind: 'mode-neutral-core-object-registry-slice-v2', players: { p1: player(), p2: player() }, turnOrder: ['p1', 'p2'], activePlayerId: 'p1',
      cardDefinitions: { d: { source: { kind: 'engine-synthetic' }, name: 'Card', layout: 'normal', manaValue: 0, colorIdentity: [], typeLine: 'Sorcery', keywords: [], producedMana: [], tokenKind: null, faces: [{ name: 'Card', manaCost: null, typeLine: 'Sorcery', oracleText: '', power: null, toughness: null, loyalty: null, defense: null }] } },
      physicalCards: { pc: { definitionId: 'd', ownerPlayerId: P1, isCommander: false } },
      objects: { 'pc:0': { kind: 'card', physicalCardId: 'pc', incarnation: 0, baseControllerPlayerId: zone === 'battlefield' ? P1 : null } },
      zones: { byPlayer, shared },
    },
    objectRuntime: { kind: 'mode-neutral-core-object-runtime-slice-v2', byObject: { 'pc:0': { orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false }, counterDamage: { counters: [], markedDamage: 0 }, attachment: { attachedTo: null } } } },
    stackAnnouncements: { kind: 'mode-neutral-core-stack-announcement-slice-v1', byObject: {} },
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

const emptyAnnouncement = {
  kind: 'card-spell', abilityTextSnapshot: null, chosenModeKeys: [], targetSelections: [], announcedVariables: [], distributions: [], costChoices: { alternativeCost: null, additionalCosts: [] },
};

describe('card spell commit deterministic properties', () => {
  it('has the same canonical bytes for every permitted source zone and repeated execution', () => {
    const zones = ['library', 'hand', 'graveyard', 'battlefield', 'exile', 'command'] as const;
    for (const zone of zones) {
      const first = commitCoreCardSpellToStackV1(makeBundle(zone), { sourceObjectId: 'pc:0', controllerPlayerId: P2, announcement: emptyAnnouncement });
      const second = commitCoreCardSpellToStackV1(makeBundle(zone), { sourceObjectId: 'pc:0', controllerPlayerId: P2, announcement: emptyAnnouncement });
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(first.committedObjectId).toBe('pc:1');
      expect(first.bundle.objectRegistry.zones.shared.stack).toEqual(['pc:1']);
    }
  });
});
