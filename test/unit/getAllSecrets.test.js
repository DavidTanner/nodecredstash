const AWS = require('aws-sdk-mock');

const encryption = require('./utils/encryption');
const encrypter = require('../../src/lib/encrypter');
const Credstash = require('../../src');

let items;
let kms;

const item1 = encryption.item;
const item2 = encryption.credstashKey;

const defCredstash = (options) => new Credstash(Object.assign({ awsOpts: { region: 'us-east-1' } }, options));

const addItem = (item) => {
  items[item.name] = items[item.name] || {};
  items[item.name][item.version] = {
    contents: item.contents,
    key: item.key,
    hmac: item.hmac || item.hmacSha256,
    name: item.name,
    version: item.version,
  };
  kms[item.key] = item.kms;
};

beforeEach(() => {
  items = {};
  kms = {};

  addItem(item1);
  addItem(item2);

  AWS.mock('DynamoDB.DocumentClient', 'scan', (params, cb) => {
    const Items = [];
    Object.keys(items).forEach((name) => {
      const next = items[name];
      Object.keys(next).forEach((version) => Items.push(next[version]));
    });
    cb(undefined, { Items });
  });

  AWS.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
    const Item = items[params.Key.name][params.Key.version];
    cb(undefined, { Item });
  });

  AWS.mock('KMS', 'decrypt', (params, cb) => {
    cb(undefined, kms[params.CiphertextBlob.toString('base64')]);
  });
});

test('should return all secrets', () => {
  const credstash = defCredstash();
  return credstash.getAllSecrets()
    .then((res) => {
      expect(Object.keys(res)).toHaveLength(2);
      const unsorted = Object.keys(res);
      const sorted = Object.keys(res).sort();
      expect(unsorted).toEqual(sorted);
    });
});

test('should return all secrets starts with "some.secret"', () => {
  const credstash = defCredstash();
  return credstash.getAllSecrets({ startsWith: 'some.secret' })
    .then((res) => {
      expect(Object.keys(res)).toHaveLength(1);
      expect(Object.keys(res)[0]).toMatch(/^some.secret.*/);
      const unsorted = Object.keys(res);
      const sorted = Object.keys(res).sort();
      expect(unsorted).toEqual(sorted);
    });
});

test('should ignore bad secrets', () => {
  const item3 = Object.assign({}, item1);
  item3.contents += 'hello broken';
  item3.name = 'differentName';
  addItem(item3);
  const credstash = defCredstash();
  return credstash.getAllSecrets()
    .then((res) => {
      expect(Object.keys(res)).toHaveLength(2);
      const unsorted = Object.keys(res);
      const sorted = Object.keys(res).sort();
      expect(unsorted).toEqual(sorted);
    });
});

test('should return all secrets, but only latest version', () => {
  const item3 = Object.assign({}, item1);
  item3.version = item3.version.replace('1', '2');
  item3.plainText = 'This is a new plaintext';
  const encrypted = encrypter.encrypt(undefined, item3.plainText, item3.kms);
  item3.contents = encrypted.contents;
  item3.hmac = encrypted.hmac;

  addItem(item3);

  const credstash = defCredstash();
  expect(credstash.getAllSecrets()).resolves.toEqual(expect.objectContaining({
    [item3.name]: item3.plainText,
  }));
});
