const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { DecryptCommand } = require('@aws-sdk/client-kms');

const encryption = require('./utils/encryption');
const { mockDocClient, mockKms } = require('./utils/awsSdk');
const { defCredstash } = require('./utils/general');

test.each([
  undefined,
  { limit: 5 },
])('%# should reject requests without a name', async (params) => {
  const credstash = defCredstash();
  await expect(credstash.getAllVersions(params)).rejects.toThrow('name is a required parameter');
});

test('should fetch and decode the secrets', async () => {
  const name = 'name';
  const limit = 5;
  const rawItem = encryption.credstashKey;

  mockDocClient.on(QueryCommand).resolves({
    Items: [
      {
        version: '0000000000000000006',
        contents: rawItem.contents,
        key: rawItem.key,
        hmac: rawItem.hmac,
      },
    ],
  });

  mockKms.on(DecryptCommand).resolves(rawItem.kms);

  const credentials = defCredstash();
  const allVersions = await credentials.getAllVersions({
    name,
    limit,
  });
  expect(allVersions[0]).toHaveProperty('version', '0000000000000000006');
  expect(allVersions[0]).toHaveProperty('secret', rawItem.plainText);
  expect(mockDocClient.commandCalls(
    QueryCommand,
    { Limit: limit, ExpressionAttributeValues: { ':name': name } },
  )).toHaveLength(1);
  expect(mockKms.commandCalls(
    DecryptCommand,
    { CiphertextBlob: rawItem.kms.CiphertextBlob },
  )).toHaveLength(1);
});

test('should default to all versions', async () => {
  const name = 'name';
  const rawItem = encryption.credstashKey;

  mockDocClient.on(QueryCommand).resolves({
    Items: [
      {
        version: '0000000000000000006',
        contents: rawItem.contents,
        key: rawItem.key,
        hmac: rawItem.hmac,
      },
    ],
  });

  mockKms.on(DecryptCommand).resolves(rawItem.kms);

  const credentials = defCredstash();
  const allVersions = await credentials.getAllVersions({
    name,
  });
  expect(allVersions[0]).toHaveProperty('version', '0000000000000000006');
  expect(allVersions[0]).toHaveProperty('secret', rawItem.plainText);
  expect(mockDocClient.commandCalls(
    QueryCommand,
    { Limit: undefined, ExpressionAttributeValues: { ':name': name } },
  )).toHaveLength(1);
  expect(mockKms.commandCalls(
    DecryptCommand,
    { CiphertextBlob: rawItem.kms.CiphertextBlob },
  )).toHaveLength(1);
});
