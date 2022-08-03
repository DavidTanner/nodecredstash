import { QueryCommand } from '@aws-sdk/lib-dynamodb';

import { mockDocClient } from './utils/awsSdk';
import { CredStash } from '../../src';

test('should reject non integer versions', () => {
  mockDocClient.on(QueryCommand).resolves({
    Items: [
      {
        version: 'hello world',
      },
    ],
  });
  const credStash = new CredStash();
  return credStash.incrementVersion({ name: 'name' })
    .then(() => 'Should not get here')
    .catch((err) => {
      expect(err.message).toContain('is not an int');
    });
});

test('should return a padded version integer', async () => {
  mockDocClient.on(QueryCommand).resolves({ Items: [{ version: '1' }] });
  const credStash = new CredStash();
  await expect(credStash.incrementVersion({ name: 'name' })).resolves.toBe('0000000000000000002');
});

test('should accept name as a param', async () => {
  const name = 'name';
  mockDocClient.on(
    QueryCommand,
    { ExpressionAttributeValues: { ':name': name } },
  ).resolves({ Items: [{ version: '1' }] });
  const credStash = new CredStash();
  await expect(credStash.incrementVersion({ name })).resolves.toBe('0000000000000000002');
});
