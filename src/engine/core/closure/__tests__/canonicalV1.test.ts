import { describe, expect, it } from 'vitest';
import { coreSha256HexV1, serializeCoreCanonicalValueV1 } from '../index';

describe('O4P-01N canonical Core values', () => {
  it('matches standard SHA-256 vectors', () => {
    expect(coreSha256HexV1('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(coreSha256HexV1('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('uses deterministic UTF-16 key ordering and rejects accessors', () => {
    expect(serializeCoreCanonicalValueV1({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    const hostile = {} as { value: number };
    Object.defineProperty(hostile, 'value', { enumerable: true, get: () => 1 });
    expect(() => serializeCoreCanonicalValueV1(hostile)).toThrow();
  });

  it('rejects cycles without rejecting repeated non-cyclic references', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => serializeCoreCanonicalValueV1(cyclic)).toThrow(/Invalid Core canonical value/);

    const shared = { value: 1 };
    expect(serializeCoreCanonicalValueV1({ left: shared, right: shared })).toBe('{"left":{"value":1},"right":{"value":1}}');
  });
});
