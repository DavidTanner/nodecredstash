const AWS = require('aws-sdk-mock');
const KMS = require('../../../src/lib/kms');

describe('kms', () => {
  describe('#decrypt', () => {
    test('should call decrypt with key and context', () => {
      const key = 'key';
      const context = { key: 'value' };
      AWS.mock('KMS', 'decrypt', (params, cb) => {
        expect(params.CiphertextBlob).toBeDefined();
        expect(params.CiphertextBlob).toBe(key);
        expect(params.EncryptionContext).toBeDefined();
        expect(params.EncryptionContext).toBe(context);
        cb();
      });
      const kms = new KMS();
      return kms.decrypt(key, context);
    });
  });

  describe('#getEncryptionKey', () => {
    test('should call getEncryptionKey with correct params', () => {
      const key = 'key';
      const context = { key: 'value' };
      AWS.mock('KMS', 'generateDataKey', (params, cb) => {
        expect(params.NumberOfBytes).toBeDefined();
        expect(params.NumberOfBytes).toBe(64);
        expect(params.EncryptionContext).toBeDefined();
        expect(params.EncryptionContext).toBe(context);
        expect(params.KeyId).toBeDefined();
        expect(params.KeyId).toBe(key);
        cb();
      });
      const kms = new KMS(key);
      return kms.getEncryptionKey(context);
    });
  });
});
