const crypto = require('node:crypto');
const config = require('../../src/config/config');

/**
 * A software authenticator for the API tests: an ECDSA P-256 key that answers registration and sign-in
 * options the way a browser with a passkey would, with "none" attestation. The browser tests use Chromium's
 * virtual authenticator instead.
 */

// The few CBOR types an authenticator needs: unsigned and negative integers, byte and text strings, maps.
const head = (major, length) => {
  if (length < 24) return Buffer.from([(major << 5) | length]);
  if (length < 256) return Buffer.from([(major << 5) | 24, length]);
  const bytes = Buffer.alloc(3);
  bytes[0] = (major << 5) | 25;
  bytes.writeUInt16BE(length, 1);
  return bytes;
};

const cbor = (value) => {
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
  if (typeof value === 'string') return Buffer.concat([head(3, Buffer.byteLength(value)), Buffer.from(value)]);
  if (value instanceof Map) {
    return Buffer.concat([head(5, value.size), ...[...value].flatMap(([key, item]) => [cbor(key), cbor(item)])]);
  }
  return value >= 0 ? head(0, value) : head(1, -1 - value);
};

const sha256 = (data) => crypto.createHash('sha256').update(data).digest();

const FLAGS = { userPresent: 0x01, userVerified: 0x04, attestedData: 0x40 };

const createAuthenticator = ({
  origin = new URL(config.appUrl).origin,
  rpId = new URL(config.appUrl).hostname,
} = {}) => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const rawId = crypto.randomBytes(16);
  const id = rawId.toString('base64url');
  let counter = 0;

  const clientData = (type, challenge) => Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  const authenticatorData = (flags, attested = Buffer.alloc(0)) => {
    const count = Buffer.alloc(4);
    count.writeUInt32BE(counter);
    return Buffer.concat([sha256(rpId), Buffer.from([flags]), count, attested]);
  };

  return {
    id,
    // Answer to navigator.credentials.create() for the given options.
    register(options, { challenge = options.challenge } = {}) {
      const coseKey = cbor(
        new Map([
          [1, 2],
          [3, -7],
          [-1, 1],
          [-2, Buffer.from(jwk.x, 'base64url')],
          [-3, Buffer.from(jwk.y, 'base64url')],
        ])
      );
      const idLength = Buffer.alloc(2);
      idLength.writeUInt16BE(rawId.length);
      const attested = Buffer.concat([Buffer.alloc(16), idLength, rawId, coseKey]);
      const authData = authenticatorData(FLAGS.userPresent | FLAGS.userVerified | FLAGS.attestedData, attested);
      const attestationObject = cbor(
        new Map([
          ['fmt', 'none'],
          ['attStmt', new Map()],
          ['authData', authData],
        ])
      );
      return {
        id,
        rawId: id,
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: clientData('webauthn.create', challenge).toString('base64url'),
          attestationObject: attestationObject.toString('base64url'),
          transports: ['internal'],
        },
      };
    },
    // Answer to navigator.credentials.get(); every call counts the signature counter up.
    sign(options, { challenge = options.challenge, as = id } = {}) {
      counter += 1;
      const authData = authenticatorData(FLAGS.userPresent | FLAGS.userVerified);
      const data = clientData('webauthn.get', challenge);
      const signature = crypto.sign('sha256', Buffer.concat([authData, sha256(data)]), privateKey);
      return {
        id: as,
        rawId: as,
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: data.toString('base64url'),
          authenticatorData: authData.toString('base64url'),
          signature: signature.toString('base64url'),
        },
      };
    },
  };
};

module.exports = { createAuthenticator };
