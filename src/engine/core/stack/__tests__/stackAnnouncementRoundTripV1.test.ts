import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  createModeNeutralCoreStackAnnouncementSliceV1,
} from "../stackAnnouncementSliceV1";
import { validateModeNeutralCoreStackAnnouncementSliceV1 } from "../stackAnnouncementValidationV1";

type Raw = Record<string, unknown>;

function readJson(url: URL): Raw {
  return JSON.parse(readFileSync(url, "utf8")) as Raw;
}

function registry(): Raw {
  return readJson(new URL("../../object/fixtures/object-registry-v2.json", import.meta.url));
}

function fixture(): Raw {
  return readJson(new URL("../fixtures/stack-announcement-v1.json", import.meta.url));
}

function deepFreezeCheck(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) deepFreezeCheck(descriptor.value, seen);
  }
}

describe("O4P-01I stack announcement fixture round trip V1", () => {
  it("round-trips canonical JSON, preserves historical targets, and never mutates input", () => {
    const raw = fixture();
    const before = JSON.stringify(raw);
    const result = validateModeNeutralCoreStackAnnouncementSliceV1(registry(), {
      ...raw,
      kind: "mode-neutral-core-stack-announcement-slice-v1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(JSON.stringify(raw)).toBe(before);
    expect(result.value).not.toBe(raw);
    expect(Object.values(result.value.byObject)[2].targetSelections[0]).toEqual({
      selectionId: "ability-history",
      groupKey: "damage-a",
      target: { kind: "object", objectId: "@spell-copy:historical-target" },
    });
    expect(JSON.stringify(result.value)).toBe(
      JSON.stringify(JSON.parse(JSON.stringify(result.value))),
    );
    deepFreezeCheck(result.value);

    const reparsed = JSON.parse(JSON.stringify(result.value)) as Raw;
    const roundTrip = validateModeNeutralCoreStackAnnouncementSliceV1(registry(), reparsed);
    expect(roundTrip.ok).toBe(true);
    if (!roundTrip.ok) return;
    expect(JSON.stringify(roundTrip.value)).toBe(JSON.stringify(result.value));

    const factoryInput = fixture();
    const created = createModeNeutralCoreStackAnnouncementSliceV1(registry() as never, factoryInput as never);
    expect(JSON.stringify(factoryInput)).toBe(JSON.stringify(fixture()));
    expect(JSON.stringify(created)).toBe(JSON.stringify(result.value));
    deepFreezeCheck(created);
  });
});
