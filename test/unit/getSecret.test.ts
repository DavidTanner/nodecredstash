import { test, expect } from 'vitest';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DecryptCommand, InvalidCiphertextException } from '@aws-sdk/client-kms';

import { credStashKey } from './utils/encryption';
import { mockDocClient, mockKms } from './utils/awsSdk';
import { CredStash } from '../../src';

const credStash = new CredStash();

test('should fetch and decode a secret', async () => {
  const name = 'name';
  const version = 'version1';
  mockDocClient.on(GetCommand).resolves({
    Item: {
      contents: credStashKey.contents,
      key: credStashKey.key,
      hmac: credStashKey.hmac,
    },
  });
  mockKms.on(DecryptCommand).resolves(credStashKey.kms);

  await expect(credStash.getSecret({
    name,
    version,
  })).resolves.toBe(credStashKey.plainText);
  expect(mockDocClient.commandCalls(GetCommand, { Key: { name, version } })).toHaveLength(1);
  expect(mockKms.commandCalls(
    DecryptCommand,
    { CiphertextBlob: credStashKey.kms.CiphertextBlob },
  )).toHaveLength(1);
});

test('should not reject a missing version', async () => {
  const version = 'version1';
  mockDocClient.on(QueryCommand).resolves({
    Items: [
      {
        contents: credStashKey.contents,
        key: credStashKey.key,
        hmac: credStashKey.hmac,
        version,
      },
    ],
  });
  mockKms.on(DecryptCommand).resolves(credStashKey.kms);
  await expect(credStash.getSecret({ name: 'name' })).resolves.toBe(credStashKey.plainText);
});

test('should default version to the latest', async () => {
  const name = 'name';
  mockDocClient.on(GetCommand).rejects(new Error('Error'));
  mockDocClient.on(QueryCommand, { ExpressionAttributeValues: { ':name': name } }).resolves({
    Items: [
      {
        contents: credStashKey.contents,
        key: credStashKey.key,
        hmac: credStashKey.hmac,
      },
    ],
  });
  mockKms.on(DecryptCommand).resolves(credStashKey.kms);

  await expect(credStash.getSecret({
    name: 'name',
  }))
    .resolves.toBe(credStashKey.plainText);
  expect(mockDocClient.commandCalls(
    QueryCommand,
    { ExpressionAttributeValues: { ':name': name } },
  )).toHaveLength(1);
  expect(mockKms.commandCalls(
    DecryptCommand,
    { CiphertextBlob: credStashKey.kms.CiphertextBlob },
  )).toHaveLength(1);
});

test('should throw an exception for a missing key', async () => {
  const name = 'name';
  const version = 'version1';
  mockDocClient.on(GetCommand).resolves({
    Item: {
      contents: credStashKey.contents,
      hmac: credStashKey.hmac,
    },
  });
  mockKms.on(DecryptCommand).rejects(new Error('Error'));

  await expect(credStash.getSecret({
    name,
    version,
  })).rejects.toThrow('could not be found');
});

test('should throw an exception for invalid cipherText, no context', async () => {
  const name = 'name';
  const version = 'version1';
  mockDocClient.on(GetCommand).resolves({
    Item: {
      contents: credStashKey.contents,
      hmac: credStashKey.hmac,
      key: credStashKey.key,
    },
  });
  mockKms.on(DecryptCommand).rejects(new InvalidCiphertextException(
    // @ts-expect-error
    {},
  ));

  await expect(credStash.getSecret({
    name,
    version,
  })).rejects.toThrow('The credential may require that an encryption');
});

test('should throw an exception for invalid cipherText, with context', async () => {
  const name = 'name';
  const version = 'version1';
  mockDocClient.on(GetCommand).resolves({
    Item: {
      contents: credStashKey.contents,
      hmac: credStashKey.hmac,
      key: credStashKey.key,
    },
  });
  mockKms.on(DecryptCommand).rejects(new InvalidCiphertextException(
    // @ts-expect-error
    {},
  ));

  await expect(credStash.getSecret({
    name,
    version,
    context: {
      key: 'value',
    },
  })).rejects.toThrow('The encryption context provided may not match');
});

test('should throw other errors', async () => {
  const name = 'name';
  const version = 'version1';
  mockDocClient.on(GetCommand).resolves({
    Item: {
      contents: credStashKey.contents,
      hmac: credStashKey.hmac,
      key: credStashKey.key,
    },
  });
  mockKms.on(DecryptCommand).rejects(new Error('Correct Error'));

  await expect(credStash.getSecret({
    name,
    version,
    context: {
      key: 'value',
    },
  })).rejects.toThrow('Decryption error');
});
