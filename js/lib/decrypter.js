'use strict';

const aesjs = require('aes-js');

const utils = require('./utils');

module.exports = {
  decryptAes(key, encrypted) {
    const decoded = utils.b64decode(encrypted);
    const counter = new aesjs.Counter(1);

    const aesCtr = new aesjs.ModeOfOperation.ctr(key, counter);  // eslint-disable-line new-cap
    const encoded = aesCtr.decrypt(decoded);
    const decrypted = aesjs.utils.utf8.fromBytes(encoded);

    return decrypted;
  },

  decrypt(item, kms) {
    const name = item.name;
    const contents = item.contents;
    const hmac = item.hmac;
    const digest = item.digest;

    const keys = utils.splitKmsKey(kms.Plaintext);

    const hmacCalc = utils.calculateHmac(digest, keys.hmacKey, contents);

    if (hmacCalc != hmac) {
      throw new Error(`Computed HMAC on ${name} does not match stored HMAC`);
    }

    const decrypted = this.decryptAes(keys.dataKey, contents);
    return decrypted;
  },
};
