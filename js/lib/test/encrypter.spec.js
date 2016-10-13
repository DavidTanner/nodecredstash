'use strict';

/* eslint-disable no-unused-expressions, no-undef */

require('../../test/setup');
const encrypter = require('../encrypter');
const encryption = require('../../test/utils/encryption');

describe('encryptor', () => {
  const encryptedItem = encryption.item;

  describe('#encrypt', () => {
    const encrypt = encrypter.encrypt.bind(encrypter);
    it(`can encrypt ${encryptedItem.name} with default HMAC`, () => {
      const kms = encryptedItem.kms;

      const encrypted = encrypt(undefined, encryptedItem.plainText, kms);
      encrypted.contents.should.equal(encryptedItem.contents);
      encrypted.hmac.should.equal(encryptedItem.hmacSha256);
    });

    it(`can encrypt ${encryptedItem.name} with explicit SHA256 HMAC`, () => {
      const kms = encryptedItem.kms;

      const encrypted = encrypt('SHA256', encryptedItem.plainText, kms);
      encrypted.contents.should.equal(encryptedItem.contents);
      encrypted.hmac.should.equal(encryptedItem.hmacSha256);
    });

    it(`can encrypt ${encryptedItem.name} with SHA512 HMAC`, () => {
      const kms = encryptedItem.kms;

      const encrypted = encrypt('SHA512', encryptedItem.plainText, kms);
      encrypted.contents.should.equal(encryptedItem.contents);
      encrypted.hmac.should.equal(encryptedItem.hmacSha512);
    });

    it(`can encrypt ${encryptedItem.name} with MD5 HMAC`, () => {
      const kms = encryptedItem.kms;

      const encrypted = encrypt('MD5', encryptedItem.plainText, kms);
      encrypted.contents.should.equal(encryptedItem.contents);
      encrypted.hmac.should.equal(encryptedItem.hmacMd5);
    });
  });

  describe('#encryptAes', () => {
    const encryptAes = encrypter.encryptAes.bind(encrypter);
    const item = encryption.credstashKey;

    it('correctly encrypts a key', () => {
      const encrypted = encryptAes(item.kms.Plaintext.slice(0, 32), item.plainText);
      encrypted.should.equal(item.contents);
    });
  });
});
