import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockDocClient } from './utils/awsSdk';
import { CredStash } from '../../src';

test('should return the highest version', async () => {
  const Items = [
    {
      name: 'name1',
      version: 'version1',
    },
    {
      name: 'name1',
      version: 'version2',
    },
  ];
  mockDocClient.on(QueryCommand).resolves({ Items });
  const credStash = new CredStash();
  await expect(credStash.getHighestVersion({
    name: 'name1',
  })).resolves.toBe(Items[0].version);
});

test('should default to version 0000000000000000000', async () => {
  mockDocClient.on(QueryCommand).resolves({ Items: [] });
  const credStash = new CredStash();
  await expect(credStash.getHighestVersion({
    name: 'name',
  })).resolves.toBe('0000000000000000000');

  mockDocClient.on(QueryCommand).resolves({});
  await expect(credStash.getHighestVersion({
    name: 'name',
  })).resolves.toBe('0000000000000000000');
});

test('should request by name', async () => {
  const name = 'name';
  mockDocClient.on(QueryCommand).callsFake((params) => {
    expect(params.ExpressionAttributeValues).toEqual({
      ':name': name,
    });
    return Promise.resolve({
      Items: [],
    });
  });
  const credStash = new CredStash();
  await expect(credStash.getHighestVersion({
    name: 'name',
  })).resolves.toBe('0000000000000000000');
});
