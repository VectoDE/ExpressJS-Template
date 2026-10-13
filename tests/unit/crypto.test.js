// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

const { encrypt, decrypt, randomToken, sha256, safeEqual } = require('../../src/utils/crypto');

describe('crypto', () => {
  it('encrypts with a fresh IV each time and decrypts back', () => {
    const a = encrypt('JBSWY3DPEHPK3PXP');
    const b = encrypt('JBSWY3DPEHPK3PXP');
    expect(a).not.toBe(b);
    expect(a.startsWith('v1.')).toBe(true);
    expect(decrypt(a)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('refuses tampered or foreign payloads', () => {
    const [version, iv, tag, ciphertext] = encrypt('secret').split('.');
    const flipped = Buffer.from(ciphertext, 'base64url');
    flipped[0] ^= 1;
    expect(() => decrypt([version, iv, tag, flipped.toString('base64url')].join('.'))).toThrow();
    expect(() => decrypt('v2.a.b.c')).toThrow('Unsupported');
    expect(() => decrypt('plain')).toThrow('Unsupported');
  });

  it('creates URL-safe random tokens and stable hashes', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('compares strings in constant time and handles different lengths', () => {
    expect(safeEqual('token', 'token')).toBe(true);
    expect(safeEqual('token', 'tokem')).toBe(false);
    expect(safeEqual('token', 'token2')).toBe(false);
  });
});
