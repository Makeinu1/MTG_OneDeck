# CR 111.10 predefined token compiler draft

Status: Codex implementer draft for judge re-owner review.

## Grounding

- CR 701.7a: creating tokens puts the specified number of tokens with the specified characteristics onto the battlefield.
- CR 111.10: predefined-token effects use the listed definitions to determine token characteristics.
- CR 111.10b: Food is a colorless Food artifact token with the listed sacrifice/life ability.
- CR 111.10f: Clue is a colorless Clue artifact token with the listed sacrifice/draw ability.
- CR 111.10g: Blood is a colorless Blood artifact token with the listed discard/sacrifice/draw ability.

## Implemented slice

The compiler auto-emits `createToken` commands for fixed-count English clauses that create exactly one supported predefined token kind:

- `Create a Clue token.`
- `Create two Clue tokens.`
- `Create a Food token.`
- `Create a Blood token.`

The emitted token specs reuse the app's existing resource-token substrate:

- Clue: `{ name: '手掛かり', typeLine: 'Token Artifact — Clue', tokenKind: 'clue' }`
- Food: `{ name: '食物', typeLine: 'Token Artifact — Food', tokenKind: 'food' }`
- Blood: `{ name: '血', typeLine: 'Token Artifact — Blood', tokenKind: 'blood' }`

Treasure remains on the existing `effect.treasure` path and now shares the same predefined-token spec helper.

## Invariants

- CR111-TOKEN-I1: fixed-count supported predefined-token creation is `auto` and emits only `GameCommand` data.
- CR111-TOKEN-I2: variable-count token creation, such as `Create X Blood tokens`, remains `manual(variable-count)`.
- CR111-TOKEN-I3: mixed token-kind clauses, such as `Create a Clue token and a Food token`, remain manual until multi-kind parsing exists.
- CR111-TOKEN-I4: stack resolution applies the compiled `createToken` command before the stack item finishes resolving, using the existing token zone/SBA substrate.

## Defer

- Gold, Powerstone, Map, Junk, Lander, Mutagen, Vibranium, Shard, Walker, Incubator, and Role predefined tokens.
- `Investigate` as a CR 701.16 alias for Clue creation.
- Token creation with copied/modified characteristics, replacement effects, or variable counts.
- Multi-kind token clauses in one sentence.

## Golden candidates

- `cr-111-predefined-clue-token-fixed-count`: `Create two Clue tokens.` emits one `createToken` command with quantity 2 and `tokenKind: 'clue'`.
- `cr-111-predefined-food-stack-resolution`: resolving `Create a Food token.` creates a Food token on the battlefield and resolves the source stack item.
- `cr-111-predefined-token-variable-manual`: `Create X Blood tokens.` remains manual.
