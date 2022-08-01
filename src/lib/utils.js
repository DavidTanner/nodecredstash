const crypto = require('crypto');

const defaults = require('../defaults');

module.exports = {
  pause: (timeout) => new Promise((resolve) => {
    setTimeout(resolve, timeout, undefined);
  }),

  calculateHmac(digestArg, key, encrypted) {
    const digest = digestArg || 'SHA256';
    const decoded = this.b64decode(encrypted);
    // compute an HMAC using the hmac key and the ciphertext
    const hmac = crypto.createHmac(digest.toLowerCase(), key)
      .update(decoded)
      .digest()
      .toString('hex');

    return hmac;
  },

  splitKmsKey(buffer) {
    const dataKey = buffer.slice(0, 32);
    const hmacKey = buffer.slice(32);
    return {
      dataKey, hmacKey,
    };
  },

  sanitizeVersion(version, defaultVersion) {
    let sanitized = version;
    if (defaultVersion && sanitized == undefined) {
      sanitized = sanitized || 1;
    }

    if (typeof sanitized == 'number') {
      sanitized = this.paddedInt(defaults.PAD_LEN, sanitized);
    }

    sanitized = (sanitized == undefined) ? sanitized : `${sanitized}`;
    return sanitized;
  },

  b64decode(string) {
    return Buffer.from(string, 'base64');
  },

  b64encode(buffer) {
    return Buffer.from(buffer).toString('base64');
  },

  paddedInt(padLength, i) {
    const iStr = `${i}`;
    let pad = padLength - iStr.length;
    pad = pad < 0 ? 0 : pad;
    return `${'0'.repeat(pad)}${iStr}`;
  },

  sortSecrets(a, b) {
    const nameDiff = a.name.localeCompare(b.name);
    return nameDiff || b.version.localeCompare(a.version);
  },

  asPromise(...args) {
    const that = args.shift();
    const fn = args.shift();

    return new Promise((resolve, reject) => {
      fn.apply(that, args.concat((err, res) => {
        if (err) {
          return reject(err);
        }
        return resolve(res);
      }));
    });
  },

  mapPromise(array, fn) {
    let idx = 0;
    const results = [];

    function doNext() {
      if (idx >= array.length) {
        return results;
      }

      return fn(array[idx])
        .then((res) => {
          idx += 1;
          results.push(res);
        })
        .then(() => doNext());
    }

    return doNext();
  },
};
