// Property-based tests: random input against invariants, so the parsers and encoders that face user input are
// fuzzed on every test run. A failure prints the smallest input that breaks the property.
const fc = require('fast-check');
const safeRedirect = require('../../src/utils/safeRedirect');
const { clean } = require('../../src/middlewares/sanitize');
const { likePattern } = require('../../src/db/sql');
const totp = require('../../src/utils/totp');
const { encrypt, decrypt } = require('../../src/utils/crypto');
const { oneLine } = require('../../src/utils/redact');
const { newId, isId } = require('../../src/utils/id');
const { fields } = require('../../src/validations/custom.validation');

const anyText = fc.string({ unit: 'binary', maxLength: 300 });
const KNOWN_PAGES = new Set(
  [
    '',
    'dashboard',
    'security',
    'privacy',
    'imprint',
    'login',
    'login/2fa',
    'register',
    'forgot-password',
    'admin/users',
  ]
    .concat(['reset-password', 'verify-email'])
    .map((page) => `/${page}`)
);

describe('fuzzed input', () => {
  it('safeRedirect only ever leads to a known page on this site', () => {
    const target = fc.oneof(
      anyText,
      fc.webUrl(),
      fc
        .constantFrom('//', '/\\', '/%2F%2F', '/./', '/../', 'javascript:')
        .chain((prefix) => anyText.map((rest) => prefix + rest))
    );
    fc.assert(
      fc.property(target, (input) => {
        const result = safeRedirect(input, '/fallback');
        const [path] = result.split('?');
        expect(result === '/fallback' || KNOWN_PAGES.has(path) || /^\/admin\/users\/[a-f\d]{24}$/.test(path)).toBe(
          true
        );
        expect(result.startsWith('//')).toBe(false);
      })
    );
  });

  it('the sanitizer leaves no operator or prototype key at any depth', () => {
    const key = fc.oneof(fc.string(), fc.constantFrom('$gt', '$where', 'a.b', '__proto__', 'constructor', 'prototype'));
    const unsafe = (name) =>
      name.startsWith('$') || name.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(name);
    const hasUnsafeKey = (value) =>
      Boolean(value) &&
      typeof value === 'object' &&
      Object.entries(value).some(([name, item]) => unsafe(name) || hasUnsafeKey(item));
    fc.assert(
      fc.property(fc.object({ key, maxDepth: 4 }), (input) => {
        expect(hasUnsafeKey(clean(input))).toBe(false);
      })
    );
  });

  it('a LIKE pattern matches the search text literally', () => {
    fc.assert(
      fc.property(anyText, (search) => {
        const pattern = likePattern(search);
        expect(pattern.startsWith('%') && pattern.endsWith('%')).toBe(true);
        const inner = pattern.slice(1, -1);
        // Every wildcard and the escape character itself come escaped, so nothing in the text acts as a wildcard.
        expect(inner.replaceAll(/![!%_[]/g, '')).not.toMatch(/[!%_[]/);
        expect(inner.replaceAll(/!([!%_[])/g, '$1')).toBe(search.toLowerCase());
      })
    );
  });

  it('TOTP accepts the code of the moment for any secret, and base32 round-trips any bytes', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 10, maxLength: 64 }),
        fc.integer({ min: 0, max: 4_102_444_800_000 }),
        (bytes, now) => {
          const secret = totp.base32Encode(Buffer.from(bytes));
          expect([...totp.base32Decode(secret)]).toEqual([...bytes]);
          expect(totp.verify(secret, totp.generate(secret, now), { now })).not.toBeNull();
        }
      )
    );
  });

  it('encryption round-trips any text and never shows it in the stored form', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', minLength: 8, maxLength: 200 }), (text) => {
        const stored = encrypt(text);
        expect(decrypt(stored)).toBe(text);
        expect(stored.includes(text)).toBe(false);
      })
    );
  });

  it('log values stay on one line', () => {
    fc.assert(
      fc.property(anyText, (text) => {
        expect(oneLine(text)).toBe(text.replaceAll('\r', '').replaceAll('\n', ''));
      })
    );
  });

  it('ids are recognised exactly when they are 24 hex characters', () => {
    fc.assert(
      fc.property(anyText, (text) => {
        expect(isId(text)).toBe(/^[a-f\d]{24}$/.test(text));
        expect(isId(newId())).toBe(true);
      })
    );
  });

  it('form fields for codes and passkeys reject garbage without throwing', () => {
    const json = fc.oneof(
      anyText,
      fc.json(),
      fc.jsonValue().map((value) => JSON.stringify(value))
    );
    fc.assert(
      fc.property(json, (text) => {
        expect(() => fields.passkeyResponseText().validate(text)).not.toThrow();
        expect(() => fields.twoFactorCode().validate(text)).not.toThrow();
        expect(fields.passkeyResponseText().validate(text).error).toBeDefined();
      })
    );
  });
});
