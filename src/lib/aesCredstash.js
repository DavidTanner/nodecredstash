const { createCipheriv } = require('crypto');
const { b64encode, calculateHmac } = require('./utils');
const defaults = require('../defaults');

const LEGACY_NONCE = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);

const halveKey = (key) => {
  const half = Math.floor(key.length / 2);
  return {
    dataKey: key.slice(0, half),
    hmacKey: key.slice(half),
  };
};

const sealAesCtr = (plaintext, key, nonce, digest = defaults.DEFAULT_DIGEST) => {
  const { dataKey, hmacKey } = halveKey(key);
  const bits = dataKey.length * 8;
  const encryptor = createCipheriv(`aes-${bits}-ctr`, dataKey, nonce);
  const ciphertext = Buffer.concat([encryptor.update(plaintext), encryptor.final()]);
  return {
    ciphertext,
    hmac: calculateHmac(digest, hmacKey, ciphertext),
  };
};

/**
 * Encrypts `secret` using the key service.
 * You can decrypt with the companion method `open_aes_ctr_legacy`.
 * generate a 64 byte key.
 * Half will be for data encryption, the other half for HMAC
 * @param keyService
 * @param secret
 * @param digest
 */
const sealAesCtrLegacy = async (keyService, secret, digest = defaults.DEFAULT_DIGEST) => {
  const { key, encodedKey } = await keyService.generateDataKey(64);
  const { ciphertext, hmac } = sealAesCtr(secret, key, LEGACY_NONCE, digest);

  return {
    key: b64encode(encodedKey),
    contents: b64encode(ciphertext),
    hmac,
    digest,
  };
};

module.exports = {
  sealAesCtrLegacy,
};
