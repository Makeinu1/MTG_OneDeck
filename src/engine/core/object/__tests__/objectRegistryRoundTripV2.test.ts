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
});
