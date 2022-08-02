const defaults = require('../defaults');

const paddedInt = (i) => `${i}`.padStart(defaults.PAD_LEN, '0');

const pause = (timeout) => new Promise((resolve) => {
  setTimeout(resolve, timeout, undefined);
});

const sanitizeVersion = (version, defaultVersion) => {
  let sanitized = version;
  if (defaultVersion && !sanitized) {
    sanitized = sanitized || 1;
  }

  if (typeof sanitized == 'number') {
    sanitized = paddedInt(sanitized);
  }

  sanitized = (sanitized === undefined) ? sanitized : `${sanitized}`;
  return sanitized;
};

const sortSecrets = (a, b) => {
  const nameDiff = a.name.localeCompare(b.name);
  return nameDiff || b.version.localeCompare(a.version);
};

module.exports = {
  pause,
  sanitizeVersion,
  sortSecrets,
  paddedInt,
};
