import { beforeEach, test, expect } from 'vitest';
import { GenerateDataKeyCommand, DecryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { mockKms } from '../utils/awsSdk';
import { item } from '../utils/encryption';
import { KeyService } from '../../../src/lib/keyService';
import { sealAesCtrLegacy, openAesCtrLegacy } from '../../../src/lib/aesCredstash';
import { SecretRecord } from '../../../src/types';

const keyService = new KeyService(new KMSClient({}), 'key');

beforeEach(() => {
  mockKms.on(GenerateDataKeyCommand).resolves(item.kms);
  mockKms.on(DecryptCommand).resolves({ Plaintext: item.kms.Plaintext });
});

test.each([
  undefined,
  'Md5',
  'Sha256',
  'Sha512',
])('will encrypt with %s', async (providedDigest) => {
  const digest = providedDigest || 'SHA256';
  await expect(sealAesCtrLegacy(keyService, item.plainText, providedDigest))
    .resolves.toEqual({
      key: Buffer.from(item.kms.CiphertextBlob).toString('base64'),
      digest,
      contents: item.contents,
      hmac: item[`hmac${providedDigest || 'Sha256'}`],
    });
});

test.each([
  undefined,
  'Md5',
  'Sha256',
  'Sha512',
])('will decrypt with %s', async (digest) => {
  const record: SecretRecord = Object.assign({}, item);
  record.digest = digest;
  if (digest) {
    record.hmac = item[`hmac${digest}`];
  }

  await expect(openAesCtrLegacy(keyService, record)).resolves.toBe(item.plainText);

  record.hmac = { value: record.hmac as string };
  await expect(openAesCtrLegacy(keyService, record)).resolves.toBe(item.plainText);
});
