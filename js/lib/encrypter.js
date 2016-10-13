'use strict';

const aesjs = require('aes-js');

const utils = require('./utils');

module.exports = {
  encryptAes(key, plaintext) {
    const counter = new aesjs.Counter(1);

    const aesCtr = new aesjs.ModeOfOperation.ctr(key, counter); // eslint-disable-line new-cap
    const encrypted = aesCtr.encrypt(plaintext);
    const encoded = utils.b64encode(encrypted);
    return encoded;
  },

  encrypt(digest, plaintext, kms) {
    const keys = utils.splitKmsKey(kms.Plaintext);

    const wrappedKey = kms.CiphertextBlob;

    const key = utils.b64encode(wrappedKey);

    const contents = this.encryptAes(keys.dataKey, plaintext);

    // compute an HMAC using the hmac key and the ciphertext
    const hmac = utils.calculateHmac(digest, keys.hmacKey, contents);

    return {
      contents,
      hmac,
      key,
      digest,
    };
  },
};
