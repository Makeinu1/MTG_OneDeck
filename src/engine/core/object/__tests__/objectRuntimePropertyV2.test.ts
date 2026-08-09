import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2,
} from "../objectRuntimeV2";

function fixture(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as unknown;
}

describe("O4P-01H-H runtime determinism properties", () => {
  it("returns fresh deterministic deep-frozen output for repeated inputs", () => {
    const identity = fixture("../../fixtures/identity-zone-slice-v1.json");
    const runtime = fixture("../../fixtures/card-runtime-slice-v1.json");
    const first = upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2(
      identity,
      runtime,
    );
    const second = upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2(
      structuredClone(identity),
      structuredClone(runtime),
    );

    expect(first).not.toBe(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(
      (first.byObject as unknown as Readonly<Record<string, unknown>>)["PC1:0"],
    )).toBe(true);
  });
});
