const Credstash = require('../../../src');

module.exports.defCredstash = (options) => new Credstash(Object.assign({ awsOpts: { region: 'us-east-1' } }, options));

module.exports.pause = (timeout, ...args) => new Promise((resolve) => {
  setTimeout(resolve, timeout, ...args);
});
