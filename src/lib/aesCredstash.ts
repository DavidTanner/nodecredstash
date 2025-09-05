import { createCipheriv, createDecipheriv, createHmac } from 'node:crypto';
import { DEFAULT_DIGEST } from '../defaults';
import { KeyService } from './keyService';
import { SecretRecord } from '../types';

const LEGACY_NONCE = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);

const getHmacKey = (
  key: Uint8Array,
  ciphertext: Uint8Array,
  digestMethod: string,
) => createHmac(digestMethod, key)
  .update(ciphertext)
  .digest()
  .toString('hex');

const halveKey = (
  key: Uint8Array,
  splitPoint = Math.floor(key.length / 2),
) => ({
  dataKey: key.slice(0, splitPoint),
  hmacKey: key.slice(splitPoint),
});

const sealAesCtr = (
  plaintext: string,
  key: Uint8Array,
  nonce: Uint8Array,
  digest: string,
) => {
  const { dataKey, hmacKey } = halveKey(key);
  const bits = dataKey.length * 8;
  const encryptor = createCipheriv(`aes-${bits}-ctr`, dataKey, nonce);
  const ciphertext = Buffer.concat([encryptor.update(plaintext), encryptor.final()]);
  return {
    ciphertext,
    hmac: getHmacKey(hmacKey, ciphertext, digest),
  };
};

const isOpenAesCtr = (
  key: Uint8Array,
  ciphertext: Uint8Array,
  expectedHmac: string,
  digestMethod: string,
  tryLegacy = false,
) => {
  const keyLen = tryLegacy ? 32 : undefined;

  const { dataKey, hmacKey } = halveKey(key, keyLen);
  const bits = dataKey.length * 8;
  const hmac = getHmacKey(hmacKey, ciphertext, digestMethod);
  const isMatch = hmac === expectedHmac;
  if (!tryLegacy && !isMatch) {
    return isOpenAesCtr(key, ciphertext, expectedHmac, digestMethod, true);
  }
  return {
    isMatch,
    bits,
    dataKey,
  };
};

const openAesCtr = (
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  expectedHmac: string,
  digestMethod: string,
  name: string,
) => {
  const { bits, dataKey, isMatch } = isOpenAesCtr(key, ciphertext, expectedHmac, digestMethod);

  if (!isMatch) {
    const message = `Computed HMAC on ${name} does not match stored HMAC`;
    throw new Error(message);
  }

  const decryptor = createDecipheriv(`aes-${bits}-ctr`, dataKey, nonce);
  const buffer = Buffer.concat([decryptor.update(ciphertext), decryptor.final()]);
  return buffer.toString('utf-8');
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
export const sealAesCtrLegacy = async (
  keyService: KeyService,
  secret: string,
  digest = DEFAULT_DIGEST,
) => {
  const { key, encodedKey } = await keyService.generateDataKey(64);
  const { ciphertext, hmac } = sealAesCtr(secret, key, LEGACY_NONCE, digest);

  return {
    key: Buffer.from(encodedKey).toString('base64'),
    contents: ciphertext.toString('base64'),
    hmac,
    digest,
  };
};

const getHmacAsString = (hmac: string | Uint8Array): string => (
  typeof hmac === 'string' ? hmac : Buffer.from(hmac).toString('utf-8')
);

/**
 * Decrypts secrets stored by `seal_aes_ctr_legacy`.
 * Assumes that the plaintext is Unicode (non-binary).
 */
export const openAesCtrLegacy = async (
  keyService: KeyService,
  record: SecretRecord,
) => {
  const key = await keyService.decrypt(record.key);
  const digestMethod = record.digest || DEFAULT_DIGEST;
  const ciphertext = Buffer.from(record.contents, 'base64');
  let rawHmac: string | Uint8Array;
  if (typeof record.hmac === 'object' && !(record.hmac instanceof Uint8Array)) {
    rawHmac = record.hmac.value;
  } else {
    rawHmac = record.hmac;
  }
  return openAesCtr(key, LEGACY_NONCE, ciphertext, getHmacAsString(rawHmac), digestMethod, record.name);
};
