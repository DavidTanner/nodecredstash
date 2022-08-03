import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DEFAULT_TABLE } from '../../src/defaults';

import { mockDdb } from './utils/awsSdk';
import { CredStash } from '../../src';

const credStash = new CredStash();

test('has methods to match credStash', () => {
  expect(credStash).toHaveProperty('paddedInt');
  expect(credStash).toHaveProperty('getHighestVersion');
  expect(credStash).toHaveProperty('listSecrets');
  expect(credStash).toHaveProperty('putSecret');
  expect(credStash).toHaveProperty('getAllSecrets');
  expect(credStash).toHaveProperty('getAllVersions');
  expect(credStash).toHaveProperty('getSecret');
  expect(credStash).toHaveProperty('deleteSecrets');
  expect(credStash).toHaveProperty('createDdbTable');
});

test('should use a callback if provided', async () => {
  mockDdb.on(DescribeTableCommand).resolves({});
  await new Promise((resolve, reject) => {
    credStash.createDdbTable(undefined, (err) => {
      try {
        expect(err).toBeUndefined();
        expect(mockDdb.commandCalls(DescribeTableCommand, { TableName: DEFAULT_TABLE })).toHaveLength(1);
        resolve(undefined);
      } catch (e) {
        reject(e);
      }
    });
  });
});

test('should use a callback for errors, and not throw an exception', async () => {
  mockDdb.on(DescribeTableCommand).rejects('Error');
  await new Promise((resolve, reject) => {
    credStash.createDdbTable((err) => {
      try {
        expect(err).toBeDefined();
        expect(err).toHaveProperty('message', 'Error');
        expect(mockDdb.commandCalls(DescribeTableCommand, { TableName: DEFAULT_TABLE })).toHaveLength(1);
        resolve(undefined);
      } catch (error) {
        reject(error);
      }
    });
  });
});
