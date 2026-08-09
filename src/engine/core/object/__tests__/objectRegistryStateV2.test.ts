import { describe, expect, it } from "vitest";

import {
  CoreObjectRegistryCreationErrorV2,
  createModeNeutralCoreObjectRegistryStateV2,
} from "../objectRegistryStateV2";
import {
  upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2,
} from "../objectRegistryCanonicalizationV2";
import {
  validateModeNeutralCoreObjectRegistryStateV2,
} from "../objectRegistryValidationV2";

function playerState(): Record<string, unknown> {
  return {
    life: 40,
    poison: 0,
    energy: 0,
    experience: 0,
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    mulliganCount: 0,
    landsPlayedThisTurn: 0,
    spellsCastThisTurn: 0,
    drawnThisTurn: 0,
    maximumHandSizeOverride: "none",
  };
}

function definition(): Record<string, unknown> {
  return {
    source: { kind: "engine-synthetic" },
    name: "Fixture Card",
    layout: "normal",
    manaValue: 1,
    colorIdentity: [],
    typeLine: "Creature",
    keywords: [],
    producedMana: [],
    tokenKind: null,
    faces: [{
      name: "Fixture Card",
      manaCost: "{1}",
      typeLine: "Creature",
      oracleText: "",
      power: "1",
      toughness: "1",
      loyalty: null,
      defense: null,
    }],
  };
}

function mixedRegistry(): Record<string, unknown> {
  return {
    kind: "mode-neutral-core-object-registry-slice-v2",
    players: { p1: playerState(), p2: playerState() },
    turnOrder: ["p1", "p2"],
    activePlayerId: "p1",
    cardDefinitions: { def1: definition() },
    physicalCards: {
      pc1: { definitionId: "def1", ownerPlayerId: "p1", isCommander: true },
    },
    objects: {
      "pc1:0": {
        kind: "card",
        physicalCardId: "pc1",
        incarnation: 0,
        baseControllerPlayerId: "p1",
      },
      "@token:t1:0": {
        kind: "token",
        definitionId: "def1",
        ownerPlayerId: "p1",
        incarnation: 0,
        baseControllerPlayerId: "p1",
        origin: { kind: "created", sourceObjectId: null },
      },
      "@spell-copy:s1": {
        kind: "spell-copy",
        definitionId: "def1",
        controllerPlayerId: "p1",
        copiedFromObjectId: "@spell-copy:historical",
      },
      "@activated-ability:a1": {
        kind: "activated-ability",
        controllerPlayerId: "p1",
        sourceObjectId: "pc1:0",
        abilityKey: "fixture-activation",
      },
      "@triggered-ability:t2": {
        kind: "triggered-ability",
        controllerPlayerId: "p2",
        sourceObjectId: "@token:historical:0",
        abilityKey: "fixture-trigger",
      },
    },
    zones: {
      byPlayer: {
        p1: { library: [], hand: [], graveyard: [] },
        p2: { library: [], hand: [], graveyard: [] },
      },
      shared: {
        battlefield: ["pc1:0", "@token:t1:0"],
        stack: ["@spell-copy:s1", "@activated-ability:a1", "@triggered-ability:t2"],
        exile: [],
        command: [],
      },
    },
  };
}

describe("O4P-01H-G object registry state V2", () => {
  it("accepts the mixed universal registry and preserves stack order", () => {
    const result = validateModeNeutralCoreObjectRegistryStateV2(mixedRegistry());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(Object.keys(result.value.objects)).toEqual([
      "@activated-ability:a1",
      "@spell-copy:s1",
      "@token:t1:0",
      "@triggered-ability:t2",
      "pc1:0",
    ]);
    expect(result.value.zones.shared.stack).toEqual([
      "@spell-copy:s1",
      "@activated-ability:a1",
      "@triggered-ability:t2",
    ]);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.objects)).toBe(true);
    expect(Object.isFrozen(result.value.zones.shared.stack)).toBe(true);
  });

  it("creates a fresh canonical value from the kindless factory input", () => {
    const full = mixedRegistry();
    delete full.kind;
    const result = createModeNeutralCoreObjectRegistryStateV2(
      full as never,
    );

    expect(result.kind).toBe("mode-neutral-core-object-registry-slice-v2");
    expect(result).not.toBe(full);
    expect(result.objects).not.toBe(full.objects);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen((result.objects as Readonly<Record<string, unknown>>)["@token:t1:0"])).toBe(true);
    expect(full.kind).toBeUndefined();
  });

  it("upgrades a valid V1 identity slice without manufacturing synthetic objects", () => {
    const v1 = mixedRegistry();
    const objects = v1.objects as Record<string, unknown>;
    for (const objectId of Object.keys(objects)) {
      if (objectId.startsWith("@")) delete objects[objectId];
    }
    const zones = v1.zones as Record<string, unknown>;
    const shared = zones.shared as Record<string, unknown>;
    shared.stack = [];
    shared.battlefield = ["pc1:0"];
    const before = JSON.stringify(v1);

    const v1WithoutObjects = { ...v1 };
    delete v1WithoutObjects.objects;
    const upgraded = upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2({
      ...v1WithoutObjects,
      kind: "mode-neutral-core-identity-zone-slice-v1",
      cardObjects: objects,
    });

    expect(JSON.stringify(v1)).toBe(before);
    expect(Object.keys(upgraded.objects)).toEqual(["pc1:0"]);
    expect((upgraded.objects as Readonly<Record<string, unknown>>)["pc1:0"]).toEqual({
      kind: "card",
      physicalCardId: "pc1",
      incarnation: 0,
      baseControllerPlayerId: "p1",
    });
    expect(upgraded.zones.shared.battlefield).toEqual(["pc1:0"]);
    expect(Object.isFrozen(upgraded)).toBe(true);
  });

  it("fails closed for revoked registry inputs and factory ownKeys traps", () => {
    const revokedPair = Proxy.revocable({}, {});
    revokedPair.revoke();
    expect(() => validateModeNeutralCoreObjectRegistryStateV2(revokedPair.proxy)).not.toThrow();
    expect(validateModeNeutralCoreObjectRegistryStateV2(revokedPair.proxy).ok).toBe(false);

    const hostile = new Proxy({}, {
      ownKeys: () => {
        throw new Error("hostile ownKeys trap");
      },
    });
    expect(() => createModeNeutralCoreObjectRegistryStateV2(hostile as never)).toThrow(
      CoreObjectRegistryCreationErrorV2,
    );
  });
});
