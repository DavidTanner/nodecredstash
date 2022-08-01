const { GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { DecryptCommand, InvalidCiphertextException } = require('@aws-sdk/client-kms');

const encryption = require('./utils/encryption');
const { mockDocClient, mockKms } = require('./utils/awsSdk');
const { defCredstash } = require('./utils/general');

test('should fetch and decode a secret', async () => {
  const name = 'name';
  const version = 'version1';
  const rawItem = encryption.credstashKey;
  mockDocClient.on(GetCommand).resolves({
    Item: {
      contents: rawItem.contents,
      key: rawItem.key,
      hmac: rawItem.hmac,
    },
  });
  mockKms.on(DecryptCommand).resolves(rawItem.kms);

  const credentials = defCredstash();
  await expect(credentials.getSecret({
    name,
    version,
  })).resolves.toBe(rawItem.plainText);
  expect(mockDocClient.commandCalls(GetCommand, { Key: { name, version } })).toHaveLength(1);
  expect(mockKms.commandCalls(
    DecryptCommand,
    { CiphertextBlob: rawItem.kms.CiphertextBlob },
  )).toHaveLength(1);
});

test.each([
  undefined,
  { version: 'version' },
])('%# should reject a missing name', async (params) => {
  const credentials = defCredstash();
  await expect(credentials.getSecret(params))
    .rejects.toThrow('name is a required parameter');
});

test('should not reject a missing version', async () => {
  const version = 'version1';
  const rawItem = encryption.credstashKey;
  mockDocClient.on(QueryCommand).resolves({
    Items: [
      {
        contents: rawItem.contents,
        key: rawItem.key,
        hmac: rawItem.hmac,
        version,
      },
    ],
  });
  mockKms.on(DecryptCommand).resolves(rawItem.kms);
  const credentials = defCredstash();
  await expect(credentials.getSecret({ name: 'name' })).resolves.toBe(rawItem.plainText);
});

test('should default version to the latest', async () => {
  const name = 'name';
  const rawItem = encryption.credstashKey;
  mockDocClient.on(GetCommand).rejects(new Error('Error'));
  mockDocClient.on(QueryCommand, { ExpressionAttributeValues: { ':name': name } }).resolves({
    Items: [
      {
        contents: rawItem.contents,
        key: rawItem.key,
        hmac: rawItem.hmac,
      },
    ],
  });
  mockKms.on(DecryptCommand).resolves(rawItem.kms);

  const credentials = defCredstash();
  await expect(credentials.getSecret({
    name: 'name',
  }))
    .resolves.toBe(rawItem.plainText);
  expect(mockDocClient.commandCalls(
    QueryCommand,
    { ExpressionAttributeValues: { ':name': name } },
  )).toHaveLength(1);
  expect(mockKms.commandCalls(
    DecryptCommand,
    { CiphertextBlob: rawItem.kms.CiphertextBlob },
  )).toHaveLength(1);
});

test('should throw an exception for a missing key', async () => {
  const name = 'name';
  const version = 'version1';
  const rawItem = encryption.credstashKey;
  mockDocClient.on(GetCommand).resolves({
    Item: {
      contents: rawItem.contents,
      hmac: rawItem.hmac,
    },
  });
  mockKms.on(DecryptCommand).rejects(new Error('Error'));

  const credentials = defCredstash();
  await expect(credentials.getSecret({
    name,
    version,
  })).rejects.toThrow('could not be found');
});

test('should throw an exception for invalid cipherText, no context', async () => {
  const name = 'name';
  const version = 'version1';
  const rawItem = encryption.credstashKey;
  mockDocClient.on(GetCommand).resolves({
    Item: {
      contents: rawItem.contents,
      hmac: rawItem.hmac,
      key: rawItem.key,
    },
  });
  mockKms.on(DecryptCommand).rejects(new InvalidCiphertextException({}));

  const credentials = defCredstash();
  await expect(credentials.getSecret({
    name,
    version,
  })).rejects.toThrow('The credential may require that an encryption');
});

test('should throw an exception for invalid cipherText, with context', async () => {
  const name = 'name';
  const version = 'version1';
  const rawItem = encryption.credstashKey;
  mockDocClient.on(GetCommand).resolves({
    Item: {
      contents: rawItem.contents,
      hmac: rawItem.hmac,
      key: rawItem.key,
    },
  });
  mockKms.on(DecryptCommand).rejects(new InvalidCiphertextException({}));

  const credentials = defCredstash();
  await expect(credentials.getSecret({
    name,
    version,
    context: {
      key: 'value',
    },
  })).rejects.toThrow('The encryption context provided may not match');
});

test('should throw an exception for invalid cipherText, with context', async () => {
  const name = 'name';
  const version = 'version1';
  const rawItem = encryption.credstashKey;
  mockDocClient.on(GetCommand).resolves({
    Item: {
      contents: rawItem.contents,
      hmac: rawItem.hmac,
      key: rawItem.key,
    },
  });
  mockKms.on(DecryptCommand).rejects(new Error('Correct Error'));

  const credentials = defCredstash();
  await expect(credentials.getSecret({
    name,
    version,
    context: {
      key: 'value',
    },
  })).rejects.toThrow('Decryption error');
});
