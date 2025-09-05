import { beforeEach, test, expect } from 'vitest';
import { ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  DecryptCommand,
  DecryptResponse,
  GenerateDataKeyCommand,
  GenerateDataKeyResponse, KMSClient,
} from '@aws-sdk/client-kms';
import { randomBytes } from 'node:crypto';

import { item as item1, credStashKey as item2, StaticData } from './utils/encryption';
import { mockDocClient, mockKms } from './utils/awsSdk';
import { CredStash } from '../../src';
import { sealAesCtrLegacy } from '../../src/lib/aesCredstash';
import { KeyService } from '../../src/lib/keyService';
import { SecretRecord } from '../../src/types';

let items: Record<string, Record<string, SecretRecord>>;
let kms: Record<string, GenerateDataKeyResponse & DecryptResponse>;

const addItem = (item: StaticData) => {
  if (!items[item.name]) {
    items[item.name] = {};
  }
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
  const credStash = new CredStash();
  const res = await credStash.getAllSecrets();
  expect(Object.keys(res)).toHaveLength(2);
  const unsorted = Object.keys(res);
  const sorted = Object.keys(res).sort();
  expect(unsorted).toEqual(sorted);
});

test('should return all secrets starts with "some.secret"', async () => {
  const credStash = new CredStash();
  const res = await credStash.getAllSecrets({ startsWith: 'some.secret' });
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
  const credStash = new CredStash();
  const res = await credStash.getAllSecrets();
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

  const keyService = new KeyService(new KMSClient({}));

  const item3 = Object.assign({}, item1);
  item3.version = item3.version.replace('1', '2');
  item3.plainText = 'This is a new plaintext';
  const encrypted = await sealAesCtrLegacy(keyService, item3.plainText);
  item3.contents = encrypted.contents;
  item3.hmac = encrypted.hmac;
  item3.kms = kmsResults;

  addItem(item3);

  const credStash = new CredStash();
  await expect(credStash.getAllSecrets()).resolves.toEqual(expect.objectContaining({
    [item3.name]: item3.plainText,
  }));
});
