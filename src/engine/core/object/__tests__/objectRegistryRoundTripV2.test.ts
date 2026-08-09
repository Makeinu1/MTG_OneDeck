import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  validateModeNeutralCoreObjectRegistrySliceV2,
} from "../objectRegistryValidationV2";

function readFixture(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(new URL("../fixtures/object-registry-v2.json", import.meta.url), "utf8"),
  ) as Record<string, unknown>;
}

function reverseRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).reverse());
}

describe("O4P-01H-T canonical fixture round trip", () => {
  it("is deterministic across record insertion order and preserves zone order", () => {
    const firstInput = readFixture();
    const secondInput = structuredClone(firstInput);
    const second = secondInput;
    for (const key of ["players", "cardDefinitions", "physicalCards", "objects"]) {
      second[key] = reverseRecord(second[key] as Record<string, unknown>);
    }
    const zones = second.zones as Record<string, unknown>;
    const byPlayer = zones.byPlayer as Record<string, unknown>;
    zones.byPlayer = reverseRecord(byPlayer);

    const first = validateModeNeutralCoreObjectRegistrySliceV2(firstInput);
    const reordered = validateModeNeutralCoreObjectRegistrySliceV2(second);
    expect(first.ok).toBe(true);
    expect(reordered.ok).toBe(true);
    if (!first.ok || !reordered.ok) {
      throw new Error("fixture must validate");
    }
    expect(JSON.stringify(first.value)).toBe(JSON.stringify(reordered.value));
    expect(first.value.zones.shared.stack).toEqual([
      "PC5:1",
      "@spell-copy:fixture-copy",
      "@activated-ability:fixture-activation",
      "@triggered-ability:fixture-trigger",
    ]);
    expect(Object.isFrozen(first.value)).toBe(true);
    expect(JSON.stringify(firstInput)).toBe(JSON.stringify(readFixture()));
  });

  it("keeps turn order semantic while sorting player records canonically", () => {
    const input = readFixture();
    input.turnOrder = [...(input.turnOrder as string[])].reverse();
    const result = validateModeNeutralCoreObjectRegistrySliceV2(input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.value.turnOrder).toEqual(["P4", "P3", "P2", "P1"]);
    expect(Object.keys(result.value.players)).toEqual(["P1", "P2", "P3", "P4"]);
    expect(Object.keys(result.value.zones.byPlayer)).toEqual(["P1", "P2", "P3", "P4"]);
  });
});
