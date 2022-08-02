const { GenerateDataKeyCommand, DecryptCommand } = require('@aws-sdk/client-kms');
const { mockKms } = require('../utils/awsSdk');
const encryption = require('../utils/encryption');
const { KeyService } = require('../../../src/lib/keyService');
const { sealAesCtrLegacy, openAesCtrLegacy } = require('../../../src/lib/aesCredstash');

const encryptedItem = encryption.item;
const keyService = new KeyService(mockKms, 'key');

beforeEach(() => {
  mockKms.on(GenerateDataKeyCommand).resolves(encryptedItem.kms);
  mockKms.on(DecryptCommand).resolves({ Plaintext: encryptedItem.kms.Plaintext });
});

test.each([
  undefined,
  'Md5',
  'Sha256',
  'Sha512',
])('will encrypt with %s', async (providedDigest) => {
  const digest = providedDigest || 'SHA256';
  await expect(sealAesCtrLegacy(keyService, encryptedItem.plainText, providedDigest))
    .resolves.toEqual({
      key: Buffer.from(encryptedItem.kms.CiphertextBlob).toString('base64'),
      digest,
      contents: encryptedItem.contents,
      hmac: encryptedItem[`hmac${providedDigest || 'Sha256'}`],
    });
});

test.each([
  undefined,
  'Md5',
  'Sha256',
  'Sha512',
])('will decrypt with %s', async (digest) => {
  const record = Object.assign({}, encryptedItem);
  record.digest = digest;
  if (digest) {
    record.hmac = record[`hmac${digest}`];
  } else {
    record.hmac = record.hmacSha256;
  }

  await expect(openAesCtrLegacy(keyService, record)).resolves.toBe(record.plainText);

  record.hmac = { value: record.hmac };
  await expect(openAesCtrLegacy(keyService, record)).resolves.toBe(record.plainText);
});
