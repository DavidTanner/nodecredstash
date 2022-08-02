const { ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { DecryptCommand, GenerateDataKeyCommand } = require('@aws-sdk/client-kms');
const { randomBytes } = require('crypto');

const encryption = require('./utils/encryption');
const { mockDocClient, mockKms } = require('./utils/awsSdk');
const Credstash = require('../../src');
const { sealAesCtrLegacy } = require('../../src/lib/aesCredstash');
const { KeyService } = require('../../src/lib/keyService');

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

  mockDocClient.on(ScanCommand).callsFake(() => {
    const Items = [];
    Object.keys(items).forEach((name) => {
      const next = items[name];
      Object.keys(next).forEach((version) => Items.push(next[version]));
    });
    return Promise.resolve({ Items });
  });

  mockDocClient.on(GetCommand).callsFake((params) => {
    const Item = items[params.Key.name][params.Key.version];
    return Promise.resolve({ Item });
  });

  mockKms.on(DecryptCommand).callsFake((params) => Promise.resolve(kms[params.CiphertextBlob.toString('base64')]));
});

test('should return all secrets', async () => {
  const credstash = defCredstash();
  const res = await credstash.getAllSecrets();
  expect(Object.keys(res)).toHaveLength(2);
  const unsorted = Object.keys(res);
  const sorted = Object.keys(res).sort();
  expect(unsorted).toEqual(sorted);
});

test('should return all secrets starts with "some.secret"', async () => {
  const credstash = defCredstash();
  const res = await credstash.getAllSecrets({ startsWith: 'some.secret' });
  expect(Object.keys(res)).toHaveLength(1);
  expect(Object.keys(res)[0]).toMatch(/^some.secret.*/);
  const unsorted = Object.keys(res);
  const sorted = Object.keys(res).sort();
  expect(unsorted).toEqual(sorted);
});

test('should ignore bad secrets', async () => {
  const item3 = Object.assign({}, item1);
  item3.contents += 'hello broken';
  item3.name = 'differentName';
  addItem(item3);
  const credstash = defCredstash();
  const res = await credstash.getAllSecrets();
  expect(Object.keys(res)).toHaveLength(2);
  const unsorted = Object.keys(res);
  const sorted = Object.keys(res).sort();
  expect(unsorted).toEqual(sorted);
});

test('should return all secrets, but only latest version', async () => {
  const kmsResults = {
    CiphertextBlob: Buffer.from('This is the CiphertextBlob'),
    Plaintext: Buffer.from(randomBytes(64)),
  };
  mockKms.on(GenerateDataKeyCommand).resolves(kmsResults);

  const keyService = new KeyService(mockKms, 'junk');

  const item3 = Object.assign({}, item1);
  item3.version = item3.version.replace('1', '2');
  item3.plainText = 'This is a new plaintext';
  const encrypted = await sealAesCtrLegacy(keyService, item3.plainText);
  item3.contents = encrypted.contents;
  item3.hmac = encrypted.hmac;
  item3.kms = kmsResults;

  addItem(item3);

  const credstash = defCredstash();
  await expect(credstash.getAllSecrets()).resolves.toEqual(expect.objectContaining({
    [item3.name]: item3.plainText,
  }));
});
