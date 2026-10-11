const totp = require('../../src/utils/totp');

// RFC 6238, Appendix B: SHA-1 secret "12345678901234567890". The RFC lists 8 digits; we use the last 6.
const RFC_SECRET = totp.base32Encode(Buffer.from('12345678901234567890', 'ascii'));

describe('totp', () => {
  it('encodes and decodes base32 without loss', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(totp.base32Decode(RFC_SECRET).toString('ascii')).toBe('12345678901234567890');
    expect(totp.base32Decode('gezd gnbv-gy3t')).toEqual(totp.base32Decode('GEZDGNBVGY3T'));
    expect(() => totp.base32Decode('A1')).toThrow('Invalid base32');
  });

  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('matches the RFC 6238 test vector at T=%i', (seconds, expected) => {
    expect(totp.generate(RFC_SECRET, seconds * 1000)).toBe(expected);
  });

  it('generates 160-bit secrets', () => {
    const secret = totp.generateSecret();
    expect(totp.base32Decode(secret)).toHaveLength(20);
    expect(secret).not.toBe(totp.generateSecret());
  });

  it('accepts one step of clock drift on either side and nothing beyond', () => {
    const now = 1_700_000_000_000;
    const secret = totp.generateSecret();
    const code = totp.generate(secret, now);
    const step = Math.floor(now / 30000);
    expect(totp.verify(secret, code, { now })).toBe(step);
    expect(totp.verify(secret, code, { now: now + 30000 })).toBe(step);
    expect(totp.verify(secret, code, { now: now - 30000 })).toBe(step);
    expect(totp.verify(secret, code, { now: now + 90000 })).toBeNull();
  });

  it('refuses a code from a step that was already used', () => {
    const now = 1_700_000_000_000;
    const secret = totp.generateSecret();
    const code = totp.generate(secret, now);
    const step = totp.verify(secret, code, { now });
    expect(totp.verify(secret, code, { now, afterStep: step })).toBeNull();
  });

  it('rejects malformed codes without computing anything', () => {
    const secret = totp.generateSecret();
    ['', '12345', '1234567', 'abcdef', null, undefined].forEach((code) => {
      expect(totp.verify(secret, code)).toBeNull();
    });
  });

  it('builds an otpauth URL that authenticator apps understand', () => {
    const url = new URL(totp.otpauthUrl({ secret: 'ABCDEF', account: 'a@example.com', issuer: 'My App' }));
    expect(url.protocol).toBe('otpauth:');
    expect(url.host).toBe('totp');
    expect(decodeURIComponent(url.pathname)).toBe('/My App:a@example.com');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      secret: 'ABCDEF',
      issuer: 'My App',
      algorithm: 'SHA1',
      digits: '6',
      period: '30',
    });
  });
});
