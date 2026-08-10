import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { validateModeNeutralCoreObjectRegistrySliceV2 } from "../../object/objectRegistryValidationV2";
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from "../stackAnnouncementValidationV1";

type Raw = Record<string, unknown>;

const STACK_IDS = [
  "PC5:1",
  "@spell-copy:fixture-copy",
  "@activated-ability:fixture-activation",
  "@triggered-ability:fixture-trigger",
] as const;

function readJson(url: URL): Raw {
  return JSON.parse(readFileSync(url, "utf8")) as Raw;
}

function registry(): Raw {
  return readJson(new URL("../../object/fixtures/object-registry-v2.json", import.meta.url));
}

function fixture(): Raw {
  return readJson(new URL("../fixtures/stack-announcement-v1.json", import.meta.url));
}

function record(root: unknown, objectId: string): Raw {
  if (root === null || typeof root !== "object" || Array.isArray(root)) throw new Error("root must be a record");
  const byObject: unknown = Reflect.get(root, "byObject");
  if (byObject === null || typeof byObject !== "object" || Array.isArray(byObject)) throw new Error("byObject must be a record");
  const value: unknown = Reflect.get(byObject, objectId);
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("record must be an object");
  return value as Raw;
}

describe("O4P-01I stack announcement fixture V1", () => {
  it("is valid JSON and independently pins the four-player O4P-01H stack parity", () => {
    const objectResult = validateModeNeutralCoreObjectRegistrySliceV2(registry());
    expect(objectResult.ok).toBe(true);
    if (!objectResult.ok) return;
    expect(Object.keys(objectResult.value.players)).toEqual(["P1", "P2", "P3", "P4"]);
    expect(objectResult.value.zones.shared.stack).toEqual(STACK_IDS);

    const input = fixture();
    const result = validateModeNeutralCoreStackAnnouncementSliceV1(registry(), {
      ...input,
      kind: "mode-neutral-core-stack-announcement-slice-v1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value.byObject)).toEqual(STACK_IDS);
    expect(Object.values(result.value.byObject).map((entry) => entry.kind)).toEqual([
      "card-spell",
      "spell-copy",
      "activated-ability",
      "triggered-ability",
    ]);
  });

  it("pins the required announcement choices without deriving assertions from the fixture", () => {
    const input = fixture();
    const result = validateModeNeutralCoreStackAnnouncementSliceV1(registry(), {
      ...input,
      kind: "mode-neutral-core-stack-announcement-slice-v1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(record(result.value, STACK_IDS[0])).toMatchObject({
      chosenModeKeys: ["mode-card", "mode-card"],
      announcedVariables: [{ variableKey: "X", value: 3 }],
      costChoices: { alternativeCost: { costKey: "alternative" }, additionalCosts: [{ costKey: "kicker", times: 2 }] },
    });
    expect(record(result.value, STACK_IDS[1])).toMatchObject({
      chosenModeKeys: ["mode-copy", "mode-copy", "mode-copy-alt"],
      targetSelections: [{ target: { kind: "player", playerId: "P4" } }],
    });
    expect(record(result.value, STACK_IDS[2])).toMatchObject({
      abilityTextSnapshot: "Tap: choose a target and deal X damage.",
      targetSelections: [{ target: { objectId: "@spell-copy:historical-target" } }, { target: { playerId: "P99" } }],
      announcedVariables: [{ variableKey: "X", value: 0 }],
      distributions: [{ assignments: [{ targetSelectionId: "ability-history", amount: 1 }, { targetSelectionId: "ability-player", amount: 1 }] }],
    });
    expect(record(result.value, STACK_IDS[3]).abilityTextSnapshot).toBe(
      "When this triggers, choose a mode and target.",
    );
  });
});
