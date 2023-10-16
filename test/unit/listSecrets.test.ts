import { test, expect } from 'vitest';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { mockDocClient } from './utils/awsSdk';
import { CredStash } from '../../src';

test('should return all secret names and versions', async () => {
  const items = [{ name: 'name', version: 'version1' }, { name: 'name', version: 'version2' }];
  mockDocClient.on(ScanCommand).resolves({ Items: items });
  const credStash = new CredStash();
  await expect(credStash.listSecrets()).resolves.toEqual(items);
});

test('can handle empty results', async () => {
  const credStash = new CredStash();

  mockDocClient.on(ScanCommand).resolves({ Items: [] });
  await expect(credStash.listSecrets()).resolves.toEqual([]);

  mockDocClient.on(ScanCommand).resolves({});
  await expect(credStash.listSecrets()).resolves.toEqual([]);
});
