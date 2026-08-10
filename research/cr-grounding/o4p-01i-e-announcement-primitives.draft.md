# O4P-01I-E Announcement Primitives V1

- Base contract: `3b1fd76`
- Status: implemented-not-integrated
- Scope: `CoreStackChoiceKeyV1` and `CoreStackTargetRefV1` value validation and
  factory conversion only.

The implementation reuses the existing Core base-ID predicate and canonical
Object ID V2 predicate. Choice keys use the frozen ASCII grammar and reject the
unsafe record names `__proto__`, `prototype`, and `constructor`. Target refs are
closed `object`/`player` records; object IDs may be historical because this is
an announcement snapshot, not a liveness check.

Validation reads own property descriptors without invoking accessors and rejects
class instances, arrays, unknown/non-enumerable/symbol fields, and invalid IDs.
Issues are deterministic by RFC 6901 path and code-unit code order. Successful
values are fresh and deeply frozen; input is not mutated. Full stack announcement
record integration, exports, registry parity, and lifecycle remain deferred to
later O4P-01I waves.
