import { beforeEach, test, expect } from 'vitest';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { mockDocClient } from './utils/awsSdk';
import { CredStash } from '../../src';

const name = 'name';
const version = 'version';
const numVer = 42;
const credStash = new CredStash();

const response = { };

beforeEach(() => {
  mockDocClient.on(DeleteCommand).resolves(response);
});

test('should throw error if bad version provided', async () => {
  await expect(credStash.deleteSecret({ name, version: '' }))
    .rejects.toThrow('version is a required parameter');
});

test('should delete the correct item', async () => {
  await expect(credStash.deleteSecret({ name, version })).resolves.toBe(response);
  expect(mockDocClient.commandCalls(DeleteCommand, { Key: { name, version } })).toHaveLength(1);
});

test('should convert numerical versions into strings', async () => {
  await expect(credStash.deleteSecret({ name, version: numVer })).resolves.toBe(response);
  expect(mockDocClient.commandCalls(DeleteCommand, {
    Key: { name, version: `00000000000000000${numVer}` },
  })).toHaveLength(1);
});
