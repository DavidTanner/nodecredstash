const { QueryCommand } = require('@aws-sdk/lib-dynamodb');

const { defCredstash } = require('./utils/general');
const { mockDocClient } = require('./utils/awsSdk');

test('should reject non integer versions', () => {
  mockDocClient.on(QueryCommand).resolves({
    Items: [
      {
        version: 'hello world',
      },
    ],
  });
  const credstash = defCredstash();
  return credstash.incrementVersion({ name: 'name' })
    .then(() => 'Should not get here')
    .catch((err) => {
      expect(err.message).toContain('is not an int');
    });
});

test('should return a padded version integer', async () => {
  mockDocClient.on(QueryCommand).resolves({ Items: [{ version: '1' }] });
  const credstash = defCredstash();
  await expect(credstash.incrementVersion({ name: 'name' })).resolves.toBe('0000000000000000002');
});

test('should accept name as a param', async () => {
  const name = 'name';
  mockDocClient.on(
    QueryCommand,
    { ExpressionAttributeValues: { ':name': name } },
  ).resolves({ Items: [{ version: '1' }] });
  const credstash = defCredstash();
  await expect(credstash.incrementVersion({ name })).resolves.toBe('0000000000000000002');
});
