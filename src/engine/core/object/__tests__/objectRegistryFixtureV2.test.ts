import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  validateModeNeutralCoreObjectRegistrySliceV2,
} from "../objectRegistryValidationV2";
import {
  validateModeNeutralCoreObjectRuntimeSliceV2,
} from "../objectRuntimeV2";
import type { CoreGameObjectIdentityV2 } from "../tokenObjectV2";
import type { CorePlayerZonesV1 } from "../../identityZoneState";

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"),
  ) as unknown;
}

describe("O4P-01H-T committed object registry fixture", () => {
  it("contains the required universal objects and mixed stack", () => {
    const raw = fixture("object-registry-v2.json");
    const registryResult = validateModeNeutralCoreObjectRegistrySliceV2(raw);

    expect(registryResult.ok).toBe(true);
    if (!registryResult.ok) throw new Error(JSON.stringify(registryResult.issues));
    const registry = registryResult.value;
    const playerZones = registry.zones.byPlayer as unknown as Readonly<
      Record<string, CorePlayerZonesV1>
    >;
    const objects = registry.objects as unknown as Readonly<
      Record<string, CoreGameObjectIdentityV2>
    >;
    expect(Object.keys(registry.players)).toHaveLength(4);
    expect(playerZones.P1.library).toEqual(["PC1:0"]);
    expect(playerZones.P1.hand).toEqual(["PC2:0"]);
    expect(registry.zones.shared.battlefield).toContain("@token:fixture-token:0");
    expect(registry.zones.shared.stack).toEqual([
      "PC5:1",
      "@spell-copy:fixture-copy",
      "@activated-ability:fixture-activation",
      "@triggered-ability:fixture-trigger",
    ]);
    expect(registry.zones.shared.stack.at(-1)).toBe(
      "@triggered-ability:fixture-trigger",
    );
    expect(objects["@token:fixture-token:0"].kind).toBe("token");
    expect(objects["PC5:1"].kind).toBe("card");

    const runtime = fixture("../../fixtures/card-runtime-slice-v1.json") as {
      kind: string;
      byObject: Record<string, unknown>;
    };
    runtime.kind = "mode-neutral-core-object-runtime-slice-v2";
    runtime.byObject["@token:fixture-token:0"] = structuredClone(
      runtime.byObject["PC4:1"],
    );
    const runtimeResult = validateModeNeutralCoreObjectRuntimeSliceV2(
      registry,
      runtime,
    );
    expect(runtimeResult.ok).toBe(true);
    if (!runtimeResult.ok) throw new Error(JSON.stringify(runtimeResult.issues));
    expect(Object.keys(runtimeResult.value.byObject)).toContain(
      "@token:fixture-token:0",
    );
    expect(Object.keys(runtimeResult.value.byObject)).not.toContain(
      "@spell-copy:fixture-copy",
    );
  });
});
