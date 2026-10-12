const { deviceLabel } = require('../../src/utils/device');
const { redactUrl, oneLine } = require('../../src/utils/redact');
const describeFormErrors = require('../../src/utils/formErrors');
const i18n = require('../../src/i18n');
const Joi = require('joi');

describe('deviceLabel', () => {
  it.each([
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox · Windows'],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      'Safari · macOS',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
      'Chrome · Android',
    ],
    ['Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/129.0 Safari/537.36 Edg/129.0', 'Edge · Windows'],
    ['curl/8.9.1', 'curl'],
    ['', null],
    [undefined, null],
  ])('labels %p as %p', (ua, expected) => {
    expect(deviceLabel(ua)).toBe(expected);
  });
});

describe('redactUrl', () => {
  it('hides single-use tokens from email links', () => {
    expect(redactUrl('/reset-password?token=abc123&x=1')).toBe('/reset-password?token=[redacted]&x=1');
    expect(redactUrl('/verify-email?a=1&token=abc')).toBe('/verify-email?a=1&token=[redacted]');
    expect(redactUrl('/dashboard?tab=2')).toBe('/dashboard?tab=2');
  });
});

describe('oneLine', () => {
  it('keeps request data on one log line', () => {
    expect(oneLine('GET /x\r\n[fake] admin signed in\rmore\nend')).toBe('GET /x | [fake] admin signed inmore | end');
    expect(oneLine(42)).toBe('42');
  });
});

describe('describeFormErrors', () => {
  it('names each failed field once, in the requested language', () => {
    const schema = Joi.object({ email: Joi.string().email(), password: Joi.string().min(12), other: Joi.number() });
    const { error } = schema.validate({ email: 'x', password: 'short', other: 'NaN' }, { abortEarly: false });
    const { t } = i18n.forLocale('en');
    expect(describeFormErrors(error, t)).toBe(
      [t('fieldErrors.email'), t('fieldErrors.password'), t('fallbackFieldError')].join(' ')
    );
  });
});
