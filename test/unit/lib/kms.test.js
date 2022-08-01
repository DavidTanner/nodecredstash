const { DecryptCommand, GenerateDataKeyCommand } = require('@aws-sdk/client-kms');
const KMS = require('../../../src/lib/kms');
const { mockKms } = require('../utils/awsSdk');

describe('kms', () => {
  describe('#decrypt', () => {
    test('should call decrypt with key and context', async () => {
      const key = 'key';
      const context = { key: 'value' };
      mockKms.on(DecryptCommand).callsFake((params) => {
        expect(params.CiphertextBlob).toBeDefined();
        expect(params.CiphertextBlob).toBe(key);
        expect(params.EncryptionContext).toBeDefined();
        expect(params.EncryptionContext).toBe(context);
        return Promise.resolve();
      });
      const kms = new KMS();
      await expect(kms.decrypt(key, context)).resolves.not.toThrow();
    });
  });

  describe('#getEncryptionKey', () => {
    test('should call getEncryptionKey with correct params', async () => {
      const key = 'key';
      const context = { key: 'value' };
      mockKms.on(GenerateDataKeyCommand).callsFake((params) => {
        expect(params.NumberOfBytes).toBeDefined();
        expect(params.NumberOfBytes).toBe(64);
        expect(params.EncryptionContext).toBeDefined();
        expect(params.EncryptionContext).toBe(context);
        expect(params.KeyId).toBeDefined();
        expect(params.KeyId).toBe(key);
        return Promise.resolve();
      });
      const kms = new KMS(key);
      await expect(kms.getEncryptionKey(context)).resolves.not.toThrow();
    });
  });
});
