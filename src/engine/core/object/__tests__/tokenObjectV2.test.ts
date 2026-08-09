import { describe, expect, it } from "vitest";

import {
  coreActivatedAbilityObjectIdOfV2,
  coreSpellCopyObjectIdOfV2,
  coreTokenObjectIdOfV2,
  coreTokenObjectIdentityOfV2,
  coreTriggeredAbilityObjectIdOfV2,
  isCanonicalCoreObjectIdV2,
  parseCoreObjectIdV2,
  validateCoreGameObjectIdentityV2,
} from "../tokenObjectV2";
import type { CoreCardDefinitionId, CorePlayerId } from "../../ids";
import type { CoreTokenObjectIdentityV2 } from "../tokenObjectV2";

describe("O4P-01H-E token object V2", () => {
  it("formats and parses every canonical object-id family without normalization", () => {
    const tokenId = coreTokenObjectIdOfV2("seed-1", 0);
    expect(tokenId).toBe("@token:seed-1:0");
    expect(parseCoreObjectIdV2(tokenId)).toEqual({
      kind: "token",
      seed: "seed-1",
      incarnation: 0,
    });
    expect(coreSpellCopyObjectIdOfV2("spell-1")).toBe("@spell-copy:spell-1");
    expect(coreActivatedAbilityObjectIdOfV2("ability-1")).toBe(
      "@activated-ability:ability-1",
    );
    expect(coreTriggeredAbilityObjectIdOfV2("trigger-1")).toBe(
      "@triggered-ability:trigger-1",
    );
    expect(isCanonicalCoreObjectIdV2("@token:seed-1:01")).toBe(false);
    expect(isCanonicalCoreObjectIdV2(" @token:seed-1:0")).toBe(false);
    expect(isCanonicalCoreObjectIdV2("@token:seed:1:0")).toBe(false);
  });

  it("keeps created and copy provenance distinct and returns fresh frozen values", () => {
    const sourceObjectId = coreSpellCopyObjectIdOfV2("source-1");
    const input = {
      kind: "token" as const,
      definitionId: "definition-1",
      ownerPlayerId: "player-1",
      incarnation: 2,
      baseControllerPlayerId: "player-1",
      origin: { kind: "copy" as const, sourceObjectId },
    };
    const result = validateCoreGameObjectIdentityV2(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(input);
      expect(result.value).not.toBe(input);
      expect(Object.isFrozen(result.value)).toBe(true);
      if (result.value.kind === "token") {
        expect(result.value.origin).not.toBe(input.origin);
        expect(Object.isFrozen(result.value.origin)).toBe(true);
      }
    }
    expect(
      coreTokenObjectIdentityOfV2(
        "definition-1" as CoreCardDefinitionId,
        "player-1" as CorePlayerId,
        0,
        "player-1" as CorePlayerId,
        { kind: "created", sourceObjectId: null },
      ),
    ).toEqual({
      kind: "token",
      definitionId: "definition-1",
      ownerPlayerId: "player-1",
      incarnation: 0,
      baseControllerPlayerId: "player-1",
      origin: { kind: "created", sourceObjectId: null },
    });
  });

  it("accepts the existing Core base-ID grammar, including digit-first and dot IDs", () => {
    expect(
      validateCoreGameObjectIdentityV2({
        kind: "token",
        definitionId: "7.definition.v2",
        ownerPlayerId: "1.player",
        incarnation: 0,
        baseControllerPlayerId: "1.player",
        origin: { kind: "created", sourceObjectId: null },
      }).ok,
    ).toBe(true);
    expect(
      validateCoreGameObjectIdentityV2({
        kind: "card",
        physicalCardId: "7.card.v2",
        incarnation: 0,
        baseControllerPlayerId: "1.player",
      }).ok,
    ).toBe(true);
    expect(
      validateCoreGameObjectIdentityV2({
        kind: "activated-ability",
        controllerPlayerId: "1.player",
        sourceObjectId: null,
        abilityKey: "7.ability.v2",
      }).ok,
    ).toBe(true);
  });

  it("rejects malformed, accessor-backed, unknown-field, and unsafe token data completely", () => {
    const getterInput = Object.defineProperty(
      {
        kind: "token",
        definitionId: "definition-1",
        ownerPlayerId: "player-1",
        incarnation: 1,
        baseControllerPlayerId: "player-1",
        origin: { kind: "created", sourceObjectId: null },
      },
      "definitionId",
      { enumerable: true, get: () => "definition-1" },
    );
    const malformed = {
      kind: "token",
      definitionId: " definition-1",
      ownerPlayerId: "player-1",
      incarnation: -1,
      baseControllerPlayerId: "player-1",
      origin: { kind: "copy", sourceObjectId: "not-an-object-id" },
      extra: true,
    };

    const getterResult = validateCoreGameObjectIdentityV2(getterInput);
    const malformedResult = validateCoreGameObjectIdentityV2(malformed);
    expect(getterResult.ok).toBe(false);
    expect(malformedResult.ok).toBe(false);
    if (!getterResult.ok && !malformedResult.ok) {
      expect(getterResult.issues.some((issue) => issue.code === "accessor")).toBe(true);
      expect(malformedResult.issues.map((issue) => issue.path)).toEqual([
        "$.definitionId",
        "$.extra",
        "$.incarnation",
        "$.origin.sourceObjectId",
      ]);
    }
    const extraInput = {
      kind: "token" as const,
      definitionId: "definition-1",
      ownerPlayerId: "player-1",
      incarnation: 1,
      baseControllerPlayerId: "player-1",
      origin: { kind: "created" as const, sourceObjectId: null },
      extra: true,
    };
    expect(() =>
      coreTokenObjectIdentityOfV2(
        extraInput as unknown as CoreTokenObjectIdentityV2,
      ),
    ).toThrow(TypeError);
    const withoutKind = {
      definitionId: "definition-1",
      ownerPlayerId: "player-1",
      incarnation: 1,
      baseControllerPlayerId: "player-1",
      origin: { kind: "created" as const, sourceObjectId: null },
    };
    expect(() =>
      coreTokenObjectIdentityOfV2(
        withoutKind as unknown as CoreTokenObjectIdentityV2,
      ),
    ).toThrow(TypeError);
  });

  it("does not mutate caller input and rejects non-plain records", () => {
    const origin = { kind: "created" as const, sourceObjectId: null };
    const input = {
      kind: "token" as const,
      definitionId: "definition-1",
      ownerPlayerId: "player-1",
      incarnation: 1,
      baseControllerPlayerId: "player-1",
      origin,
    };
    const before = JSON.stringify(input);
    const result = validateCoreGameObjectIdentityV2(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(result.ok).toBe(true);

    expect(validateCoreGameObjectIdentityV2(new Date()).ok).toBe(false);
    expect(
      validateCoreGameObjectIdentityV2({
        kind: "token",
        definitionId: "definition-1",
        ownerPlayerId: "player-1",
        incarnation: -0,
        baseControllerPlayerId: "player-1",
        origin,
      }).ok,
    ).toBe(false);
    expect(
      validateCoreGameObjectIdentityV2({
        kind: "token",
        definitionId: "definition-1",
        ownerPlayerId: "player-1",
        incarnation: Number.MAX_SAFE_INTEGER + 1,
        baseControllerPlayerId: "player-1",
        origin,
      }).ok,
    ).toBe(false);
  });
});
