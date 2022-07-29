const encrypter = require('../../../src/lib/encrypter');
const encryption = require('../utils/encryption');

describe('encryptor', () => {
  const encryptedItem = encryption.item;

  describe('#encrypt', () => {
    const encrypt = encrypter.encrypt.bind(encrypter);
    test(`can encrypt ${encryptedItem.name} with default HMAC`, () => {
      const {
        kms,
      } = encryptedItem;

      const encrypted = encrypt(undefined, encryptedItem.plainText, kms);
      expect(encrypted.contents).toBe(encryptedItem.contents);
      expect(encrypted.hmac).toBe(encryptedItem.hmacSha256);
    });

    test(`can encrypt ${encryptedItem.name} with explicit SHA256 HMAC`, () => {
      const {
        kms,
      } = encryptedItem;

      const encrypted = encrypt('SHA256', encryptedItem.plainText, kms);
      expect(encrypted.contents).toBe(encryptedItem.contents);
      expect(encrypted.hmac).toBe(encryptedItem.hmacSha256);
    });

    test(`can encrypt ${encryptedItem.name} with SHA512 HMAC`, () => {
      const {
        kms,
      } = encryptedItem;

      const encrypted = encrypt('SHA512', encryptedItem.plainText, kms);
      expect(encrypted.contents).toBe(encryptedItem.contents);
      expect(encrypted.hmac).toBe(encryptedItem.hmacSha512);
    });

    test(`can encrypt ${encryptedItem.name} with MD5 HMAC`, () => {
      const {
        kms,
      } = encryptedItem;

      const encrypted = encrypt('MD5', encryptedItem.plainText, kms);
      expect(encrypted.contents).toBe(encryptedItem.contents);
      expect(encrypted.hmac).toBe(encryptedItem.hmacMd5);
    });
  });

  describe('#encryptAes', () => {
    const encryptAes = encrypter.encryptAes.bind(encrypter);
    const item = encryption.credstashKey;

    test('correctly encrypts a key', () => {
      const encrypted = encryptAes(item.kms.Plaintext.slice(0, 32), item.plainText);
      expect(encrypted).toBe(item.contents);
    });
  });
});
