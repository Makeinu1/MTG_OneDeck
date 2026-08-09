import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2,
  upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2,
  validateModeNeutralCoreObjectRuntimeSliceV2,
} from "../objectRuntimeV2";

function fixture(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as unknown;
}

describe("O4P-01H-H object runtime V2", () => {
  it("upgrades the existing V1 runtime without changing its key set", () => {
    const identity = fixture("../../fixtures/identity-zone-slice-v1.json");
    const runtime = fixture("../../fixtures/card-runtime-slice-v1.json");
    const beforeIdentity = JSON.stringify(identity);
    const beforeRuntime = JSON.stringify(runtime);
    const output = upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2(
      identity,
      runtime,
    );

    expect(output.kind).toBe("mode-neutral-core-object-runtime-slice-v2");
    expect(Object.keys(output.byObject)).toEqual(
      Object.keys(
        (runtime as { byObject: Readonly<Record<string, unknown>> }).byObject,
      ),
    );
    expect(JSON.stringify(identity)).toBe(beforeIdentity);
    expect(JSON.stringify(runtime)).toBe(beforeRuntime);
    expect(Object.isFrozen(output)).toBe(true);
    expect(Object.isFrozen(output.byObject)).toBe(true);
  });

  it("accepts only the card/token runtime set for an upgraded identity", () => {
    const identityInput = fixture("../../fixtures/identity-zone-slice-v1.json");
    const runtimeInput = fixture("../../fixtures/card-runtime-slice-v1.json");
    const identity =
      upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2(identityInput);
    const runtime =
      upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2(
        identityInput,
        runtimeInput,
      );
    const result = validateModeNeutralCoreObjectRuntimeSliceV2(identity, runtime);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(Object.keys(result.value.byObject)).toHaveLength(7);
    expect(JSON.stringify(result.value)).toBe(JSON.stringify(runtime));
  });
});
