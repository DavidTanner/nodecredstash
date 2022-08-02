const { GenerateDataKeyCommand, KMSClient } = require('@aws-sdk/client-kms');
const { mockKms } = require('../utils/awsSdk');
const encryption = require('../utils/encryption');
const { KeyService } = require('../../../src/lib/keyService');
const { sealAesCtrLegacy } = require('../../../src/lib/aesCredstash');

const encryptedItem = encryption.item;

test.each([
  'Md5',
  'Sha256',
  'Sha512',
])('will encrypt the key %s', async (digest) => {
  const kms = new KMSClient({});
  mockKms.on(GenerateDataKeyCommand).resolves(encryptedItem.kms);
  const keyService = new KeyService(kms, 'key');
  await expect(sealAesCtrLegacy(keyService, encryptedItem.plainText, digest))
    .resolves.toEqual({
      key: Buffer.from(encryptedItem.kms.CiphertextBlob).toString('base64'),
      digest,
      contents: encryptedItem.contents,
      hmac: encryptedItem[`hmac${digest}`],
    });
});
