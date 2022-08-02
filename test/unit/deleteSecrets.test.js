const { DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { defCredstash } = require('./utils/general');
const { mockDocClient } = require('./utils/awsSdk');

test.each([
  undefined,
  {},
])('%# should reject empty options', async (params) => {
  mockDocClient.on(QueryCommand).rejects(new Error('Error'));
  mockDocClient.on(DeleteCommand).rejects(new Error('Error'));
  const credstash = defCredstash();
  await expect(credstash.deleteSecrets(params)).rejects.toThrow('name is a required parameter');
});

test('will not fail if no secrets found', async () => {
  const credstash = defCredstash();

  mockDocClient.on(QueryCommand).resolves({ Items: [] });
  await expect(credstash.deleteSecrets({ name: 'name' })).resolves.toEqual([]);

  mockDocClient.on(QueryCommand).resolves({});
  await expect(credstash.deleteSecrets({ name: 'name' })).resolves.toEqual([]);
});

test('should delete all versions of a given name', async () => {
  const name = 'name';
  const Items = Array.from({ length: 10 }, (v, i) => ({ name, version: `${i}` }));
  mockDocClient.on(QueryCommand).resolves({ Items });
  mockDocClient.on(DeleteCommand).resolves('Success');

  const credstash = defCredstash();
  await expect(credstash.deleteSecrets({ name })).resolves.toEqual(Items.map(() => 'Success'));
  expect(mockDocClient.commandCalls(QueryCommand, { ExpressionAttributeValues: { ':name': name } })).toHaveLength(1);
  Items.forEach((_, i) => {
    expect(mockDocClient.commandCalls(DeleteCommand, { Key: { name, version: `${i}` } })).toHaveLength(1);
  });
});
