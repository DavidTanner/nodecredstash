const decrypter = require('../../../src/lib/decrypter');
const encryption = require('../utils/encryption');

const encryptedItem = encryption.item;

describe('#decrypt', () => {
  const decrypt = decrypter.decrypt.bind(decrypter);

  test(`can decrypt ${encryptedItem.name} with default digest`, () => {
    const stash = {
      name: 'item',
      hmac: encryptedItem.hmacSha256,
      contents: encryptedItem.contents,
    };

    const {
      kms,
    } = encryptedItem;

    const plainText = decrypt(stash, kms);
    expect(plainText).toBe(encryptedItem.plainText);
  });

  test(`can decrypt ${encryptedItem.name} with explicit SHA256 digest`, () => {
    const stash = {
      name: 'item',
      hmac: encryptedItem.hmacSha256,
      contents: encryptedItem.contents,
      digest: 'SHA256',
    };

    const {
      kms,
    } = encryptedItem;

    const plainText = decrypt(stash, kms);
    expect(plainText).toBe(encryptedItem.plainText);
  });

  test(`can decrypt ${encryptedItem.name} with SHA512 digest`, () => {
    const stash = {
      name: 'item',
      hmac: encryptedItem.hmacSha512,
      contents: encryptedItem.contents,
      digest: 'SHA512',
    };

    const {
      kms,
    } = encryptedItem;

    const plainText = decrypt(stash, kms);
    expect(plainText).toBe(encryptedItem.plainText);
  });

  test(`can decrypt ${encryptedItem.name} with MD5 digest`, () => {
    const stash = {
      name: 'item',
      hmac: encryptedItem.hmacMd5,
      contents: encryptedItem.contents,
      digest: 'MD5',
    };

    const {
      kms,
    } = encryptedItem;

    const plainText = decrypt(stash, kms);
    expect(plainText).toBe(encryptedItem.plainText);
  });

  test('will throw an exception if the contents has been messed with', () => {
    const stash = {
      name: 'item',
      hmac: encryptedItem.hmacMd5,
      contents: `${encryptedItem.contents}some junk`,
      digest: 'MD5',
    };

    const {
      kms,
    } = encryptedItem;
    expect(() => decrypt(stash, kms)).toThrow('does not match stored HMAC');
  });
});

describe('#decryptAes', () => {
  const decryptAes = decrypter.decryptAes.bind(decrypter);
  const credstashItem = encryption.credstashKey;

  test('correctly encrypts a key', () => {
    const encrypted = decryptAes(
      credstashItem.kms.Plaintext.slice(0, 32),
      credstashItem.contents // eslint-disable-line comma-dangle
    );
    expect(encrypted).toBe(credstashItem.plainText);
  });
});
