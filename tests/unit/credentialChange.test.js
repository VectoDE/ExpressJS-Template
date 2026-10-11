const tokenService = require('../../src/services/token.service');
const { tokenTypes } = require('../../src/config/tokens');

const userChangedAt = (ms) => ({ credentialsChangedAt: new Date(ms) });

describe('issuedBeforeCredentialChange', () => {
  it('rejects a token issued earlier in the same second as the change', () => {
    const payload = { iat: 1000, ims: 1_000_200 };
    expect(tokenService.issuedBeforeCredentialChange(payload, userChangedAt(1_000_700))).toBe(true);
  });

  it('accepts a token issued later in the same second', () => {
    const payload = { iat: 1000, ims: 1_000_900 };
    expect(tokenService.issuedBeforeCredentialChange(payload, userChangedAt(1_000_700))).toBe(false);
  });

  it('treats a token without ims as issued at the start of its second', () => {
    expect(tokenService.issuedBeforeCredentialChange({ iat: 1000 }, userChangedAt(1_000_001))).toBe(true);
    expect(tokenService.issuedBeforeCredentialChange({ iat: 1000 }, userChangedAt(1_000_000))).toBe(false);
  });

  it('signs the millisecond issue time into every token', () => {
    const before = Date.now();
    const token = tokenService.generateToken('user-id', new Date(before + 60_000), tokenTypes.ACCESS);
    const { ims } = tokenService.decodeToken(token, tokenTypes.ACCESS);
    expect(ims).toBeGreaterThanOrEqual(before);
    expect(ims).toBeLessThanOrEqual(Date.now());
  });
});
