import { describe, expect, it } from "vitest";

import {
  validateModeNeutralCoreObjectRegistryStateV2,
} from "../objectRegistryValidationV2";

function fixture(): Record<string, unknown> {
  return {
    kind: "mode-neutral-core-object-registry-slice-v2",
    players: {
      p1: {
        life: 40, poison: 0, energy: 0, experience: 0,
        manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        mulliganCount: 0, landsPlayedThisTurn: 0, spellsCastThisTurn: 0,
        drawnThisTurn: 0, maximumHandSizeOverride: "none",
      },
    },
    turnOrder: ["p1"],
    activePlayerId: "p1",
    cardDefinitions: {
      def1: {
        source: { kind: "engine-synthetic" }, name: "Fixture", layout: "normal",
        manaValue: 0, colorIdentity: [], typeLine: "Creature", keywords: [],
        producedMana: [], tokenKind: null,
        faces: [{ name: "Fixture", manaCost: null, typeLine: "Creature", oracleText: "", power: "1", toughness: "1", loyalty: null, defense: null }],
      },
    },
    physicalCards: { pc1: { definitionId: "def1", ownerPlayerId: "p1", isCommander: false } },
    objects: {
      "pc1:0": { kind: "card", physicalCardId: "pc1", incarnation: 0, baseControllerPlayerId: "p1" },
      "@token:t1:0": {
        kind: "token", definitionId: "def1", ownerPlayerId: "p1", incarnation: 0,
        baseControllerPlayerId: "p1", origin: { kind: "created", sourceObjectId: null },
      },
      "@activated-ability:a1": {
        kind: "activated-ability", controllerPlayerId: "p1", sourceObjectId: null, abilityKey: "ability-1",
      },
    },
    zones: {
      byPlayer: { p1: { library: [], hand: [], graveyard: [] } },
      shared: {
        battlefield: ["pc1:0", "@token:t1:0"],
        stack: ["@activated-ability:a1"], exile: [], command: [],
      },
    },
  };
}

function issuesOf(value: unknown): readonly { readonly code: string; readonly path: string }[] {
  const result = validateModeNeutralCoreObjectRegistryStateV2(value);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected invalid registry");
  return result.issues;
}

describe("O4P-01H-G strict registry validation", () => {
  it("rejects token and ability placement outside their allowed zones", () => {
    const value = fixture();
    const zones = value.zones as Record<string, unknown>;
    const shared = zones.shared as Record<string, unknown>;
    shared.battlefield = ["pc1:0"];
    shared.stack = [];
    shared.exile = ["@token:t1:0", "@activated-ability:a1"];

    const issues = issuesOf(value);
    expect(issues.some((issue) => issue.code === "INVALID_ZONE_FOR_OBJECT" && issue.path === "/objects/@token:t1:0")).toBe(true);
    expect(issues.some((issue) => issue.code === "INVALID_ZONE_FOR_OBJECT" && issue.path === "/objects/@activated-ability:a1")).toBe(true);
  });

  it("rejects stale references and duplicate membership", () => {
    const value = fixture();
    const zones = value.zones as Record<string, unknown>;
    const shared = zones.shared as Record<string, unknown>;
    shared.battlefield = ["pc1:0", "pc1:0", "@token:t1:0", "stale:0"];
    shared.stack = ["@activated-ability:a1", "@token:t1:0"];

    const issues = issuesOf(value);
    expect(issues.some((issue) => issue.code === "ZONE_OBJECT_NOT_FOUND")).toBe(true);
    expect(issues.some((issue) => issue.code === "OBJECT_NOT_IN_EXACTLY_ONE_ZONE" && issue.path === "/objects/pc1:0")).toBe(true);
    expect(issues.some((issue) => issue.code === "OBJECT_NOT_IN_EXACTLY_ONE_ZONE" && issue.path === "/objects/@token:t1:0")).toBe(true);
  });

  it("fails closed for accessors and unknown root fields without executing getters", () => {
    const value = fixture();
    let executed = false;
    Object.defineProperty(value, "players", {
      enumerable: true,
      get: () => {
        executed = true;
        return value.players;
      },
    });
    value.extra = true;
    const issues = issuesOf(value);

    expect(executed).toBe(false);
    expect(issues.some((issue) => issue.code === "UNKNOWN_FIELD" && issue.path === "/extra")).toBe(true);
    expect(issues.some((issue) => issue.path === "/players")).toBe(true);
  });

  it("accepts historical provenance references", () => {
    const value = fixture();
    const objects = value.objects as Record<string, unknown>;
    objects["@spell-copy:copy-1"] = {
      kind: "spell-copy", definitionId: "def1", controllerPlayerId: "p1",
      copiedFromObjectId: "@triggered-ability:historical",
    };
    const zones = value.zones as Record<string, unknown>;
    const shared = zones.shared as Record<string, unknown>;
    (shared.stack as string[]).push("@spell-copy:copy-1");

    const result = validateModeNeutralCoreObjectRegistryStateV2(value);
    expect(result.ok).toBe(true);
  });
});

