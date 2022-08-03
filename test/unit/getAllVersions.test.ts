import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DecryptCommand } from '@aws-sdk/client-kms';

import { credStashKey } from './utils/encryption';
import { mockDocClient, mockKms } from './utils/awsSdk';
import { CredStash } from '../../src';

const credStash = new CredStash();

test('will handle no results', async () => {
  mockDocClient.on(QueryCommand).resolves({ Items: [] });
  await expect(credStash.getAllVersions({ name: 'name' }))
    .resolves.toEqual([]);

  mockDocClient.on(QueryCommand).resolves({ });
  await expect(credStash.getAllVersions({ name: 'name' }))
    .resolves.toEqual([]);
});

test('should fetch and decode the secrets', async () => {
  const name = 'name';
  const limit = 5;

  mockDocClient.on(QueryCommand).resolves({
    Items: [
      {
        version: '0000000000000000006',
        contents: credStashKey.contents,
        key: credStashKey.key,
        hmac: credStashKey.hmac,
      },
    ],
  });

  mockKms.on(DecryptCommand).resolves(credStashKey.kms);

  const allVersions = await credStash.getAllVersions({
    name,
    limit,
  });
  expect(allVersions[0]).toHaveProperty('version', '0000000000000000006');
  expect(allVersions[0]).toHaveProperty('secret', credStashKey.plainText);
  expect(mockDocClient.commandCalls(
    QueryCommand,
    { Limit: limit, ExpressionAttributeValues: { ':name': name } },
  )).toHaveLength(1);
  expect(mockKms.commandCalls(
    DecryptCommand,
    { CiphertextBlob: credStashKey.kms.CiphertextBlob },
  )).toHaveLength(1);
});

test('should default to all versions', async () => {
  const name = 'name';

  mockDocClient.on(QueryCommand).resolves({
    Items: [
      {
        version: '0000000000000000006',
        contents: credStashKey.contents,
        key: credStashKey.key,
        hmac: credStashKey.hmac,
      },
    ],
  });

  mockKms.on(DecryptCommand).resolves(credStashKey.kms);

  await expect(credStash.getAllVersions({
    name,
  })).resolves.toEqual([
    { version: '0000000000000000006', secret: credStashKey.plainText },
  ]);
  expect(mockDocClient.commandCalls(
    QueryCommand,
    { Limit: undefined, ExpressionAttributeValues: { ':name': name } },
  )).toHaveLength(1);
  expect(mockKms.commandCalls(
    DecryptCommand,
    { CiphertextBlob: credStashKey.kms.CiphertextBlob },
  )).toHaveLength(1);
});
