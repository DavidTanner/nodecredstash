import { test, expect } from 'vitest';
import { DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockDocClient } from './utils/awsSdk';
import { CredStash } from '../../src';

test('will not fail if no secrets found', async () => {
  const credStash = new CredStash();

  mockDocClient.on(QueryCommand).resolves({ Items: [] });
  await expect(credStash.deleteSecrets({ name: 'name' })).resolves.toEqual([]);

  mockDocClient.on(QueryCommand).resolves({});
  await expect(credStash.deleteSecrets({ name: 'name' })).resolves.toEqual([]);
});

test('should delete all versions of a given name', async () => {
  const name = 'name';
  const response = {};
  const Items = Array.from({ length: 10 }, (v, i) => ({ name, version: `${i}` }));
  mockDocClient.on(QueryCommand).resolves({ Items });
  mockDocClient.on(DeleteCommand).resolves(response);

  const credStash = new CredStash();
  await expect(credStash.deleteSecrets({ name })).resolves.toEqual(Items.map(() => response));
  expect(mockDocClient.commandCalls(QueryCommand, { ExpressionAttributeValues: { ':name': name } })).toHaveLength(1);
  Items.forEach((_, i) => {
    expect(mockDocClient.commandCalls(DeleteCommand, { Key: { name, version: `${i}` } })).toHaveLength(1);
  });
});
