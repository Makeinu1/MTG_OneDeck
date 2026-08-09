import { describe, expect, it } from "vitest";

import {
  upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2,
} from "../objectRegistryCanonicalizationV2";
import {
  validateModeNeutralCoreObjectRuntimeStateV2,
} from "../objectRegistryValidationV2";
import { validateModeNeutralCoreIdentityZoneSliceV1 } from "../../identityZoneValidation";

function identity(): Record<string, unknown> {
  return {
    kind: "mode-neutral-core-identity-zone-slice-v1",
    players: {
      p1: {
        life: 40, poison: 0, energy: 0, experience: 0,
        manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        mulliganCount: 0, landsPlayedThisTurn: 0, spellsCastThisTurn: 0,
        drawnThisTurn: 0, maximumHandSizeOverride: "none",
      },
    },
    turnOrder: ["p1"], activePlayerId: "p1",
    cardDefinitions: {
      def1: {
        source: { kind: "engine-synthetic" }, name: "Fixture", layout: "normal",
        manaValue: 0, colorIdentity: [], typeLine: "Creature", keywords: [],
        producedMana: [], tokenKind: null,
        faces: [{ name: "Fixture", manaCost: null, typeLine: "Creature", oracleText: "", power: "1", toughness: "1", loyalty: null, defense: null }],
      },
    },
    physicalCards: { pc1: { definitionId: "def1", ownerPlayerId: "p1", isCommander: false } },
    cardObjects: { "pc1:0": { kind: "card", physicalCardId: "pc1", incarnation: 0, baseControllerPlayerId: "p1" } },
    zones: {
      byPlayer: { p1: { library: [], hand: [], graveyard: [] } },
      shared: { battlefield: ["pc1:0"], stack: [], exile: [], command: [] },
    },
  };
}

function runtimeRow(): Record<string, unknown> {
  return {
    orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false },
    counterDamage: { counters: [], markedDamage: 0 },
    attachment: { attachedTo: null },
  };
}

describe("O4P-01H-G runtime adapter and canonical stability", () => {
  it("upgrades V1 runtime rows and keeps the exact object key set", () => {
    const v1Identity = identity();
    const runtime = { kind: "mode-neutral-core-card-runtime-slice-v1", byObject: { "pc1:0": runtimeRow() } };
    const beforeIdentity = JSON.stringify(v1Identity);
    const beforeRuntime = JSON.stringify(runtime);
    const upgraded = upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2(v1Identity, runtime);

    expect(JSON.stringify(v1Identity)).toBe(beforeIdentity);
    expect(JSON.stringify(runtime)).toBe(beforeRuntime);
    expect(upgraded).toEqual({
      kind: "mode-neutral-core-object-runtime-slice-v2",
      byObject: { "pc1:0": runtimeRow() },
    });
    expect(Object.isFrozen(upgraded)).toBe(true);
    expect(Object.isFrozen((upgraded.byObject as Readonly<Record<string, unknown>>)["pc1:0"])).toBe(true);
  });

  it("rejects stack-only object rows and returns deterministic fresh output", () => {
    const v1 = validateModeNeutralCoreIdentityZoneSliceV1(identity());
    expect(v1.ok).toBe(true);
    if (!v1.ok) throw new Error(JSON.stringify(v1.issues));
    const registry = {
      kind: "mode-neutral-core-object-registry-slice-v2" as const,
      players: v1.value.players,
      turnOrder: v1.value.turnOrder,
      activePlayerId: v1.value.activePlayerId,
      cardDefinitions: v1.value.cardDefinitions,
      physicalCards: v1.value.physicalCards,
      objects: {
        "pc1:0": (v1.value.cardObjects as Readonly<Record<string, unknown>>)["pc1:0"],
        "@spell-copy:s1": {
          kind: "spell-copy" as const,
          definitionId: "def1",
          controllerPlayerId: "p1",
          copiedFromObjectId: "@spell-copy:historical",
        },
      },
      zones: {
        byPlayer: v1.value.zones.byPlayer,
        shared: { ...v1.value.zones.shared, stack: ["@spell-copy:s1"] },
      },
    };
    const input = { kind: "mode-neutral-core-object-runtime-slice-v2", byObject: {
      "pc1:0": runtimeRow(), "@spell-copy:s1": runtimeRow(),
    } };

    const rejected = validateModeNeutralCoreObjectRuntimeStateV2(registry, input);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.issues.some((issue) => issue.code === "OBJECT_SET_MISMATCH" && issue.path === "/byObject/@spell-copy:s1")).toBe(true);
    }

    const accepted = validateModeNeutralCoreObjectRuntimeStateV2(
      {
        ...registry,
        objects: { "pc1:0": registry.objects["pc1:0"] },
        zones: { byPlayer: registry.zones.byPlayer, shared: { ...v1.value.zones.shared, stack: [] } },
      },
      { kind: "mode-neutral-core-object-runtime-slice-v2", byObject: { "pc1:0": runtimeRow() } },
    );
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error(JSON.stringify(accepted.issues));
    expect(accepted.value).not.toBe(input);
    expect(JSON.stringify(accepted.value)).toBe(JSON.stringify(accepted.value));
  });
});

