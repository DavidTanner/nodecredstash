'use strict';

/* eslint-disable no-unused-expressions, no-undef */

require('../../test/setup');
const decrypter = require('../decrypter');
const encryption = require('../../test/utils/encryption');

describe('decrypter', () => {
  const encryptedItem = encryption.item;

  describe('#decrypt', () => {
    const decrypt = decrypter.decrypt.bind(decrypter);

    it(`can decrypt ${encryptedItem.name} with default digest`, () => {
      const stash = {
        name: 'item',
        hmac: encryptedItem.hmacSha256,
        contents: encryptedItem.contents,
      };

      const {
        kms,
      } = encryptedItem;

      const plainText = decrypt(stash, kms);
      plainText.should.equal(encryptedItem.plainText);
    });

    it(`can decrypt ${encryptedItem.name} with explicit SHA256 digest`, () => {
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
      plainText.should.equal(encryptedItem.plainText);
    });

    it(`can decrypt ${encryptedItem.name} with SHA512 digest`, () => {
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
      plainText.should.equal(encryptedItem.plainText);
    });

    it(`can decrypt ${encryptedItem.name} with MD5 digest`, () => {
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
      plainText.should.equal(encryptedItem.plainText);
    });

    it('will throw an exception if the contents has been messed with', () => {
      const stash = {
        name: 'item',
        hmac: encryptedItem.hmacMd5,
        contents: `${encryptedItem.contents}some junk`,
        digest: 'MD5',
      };

      const {
        kms,
      } = encryptedItem;

      try {
        const plainText = decrypt(stash, kms);
        plainText.should.not.exist;
      } catch (e) {
        e.message.should.contain('does not match stored HMAC');
      }
    });
  });

  describe('#decryptAes', () => {
    const decryptAes = decrypter.decryptAes.bind(decrypter);
    const credstashItem = encryption.credstashKey;

    it('correctly encrypts a key', () => {
      const encrypted = decryptAes(
        credstashItem.kms.Plaintext.slice(0, 32),
        credstashItem.contents // eslint-disable-line comma-dangle
      );
      encrypted.should.equal(credstashItem.plainText);
    });
  });
});
