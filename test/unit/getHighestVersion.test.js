const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { defCredstash } = require('./utils/general');
const { mockDocClient } = require('./utils/awsSdk');

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
  const credstash = defCredstash();
  await expect(credstash.getHighestVersion({
    name: 'name1',
  })).resolves.toBe(Items[0].version);
});

test('should default to version 0', async () => {
  mockDocClient.on(QueryCommand).resolves({ Items: [] });
  const credstash = defCredstash();
  await expect(credstash.getHighestVersion({
    name: 'name',
  })).resolves.toBe(0);
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
  const credstash = defCredstash();
  await expect(credstash.getHighestVersion({
    name: 'name',
  })).resolves.toBe(0);
});

test('should reject a missing name', async () => {
  mockDocClient.on(QueryCommand).rejects(new Error('Error'));
  const credstash = defCredstash();
  await expect(credstash.getHighestVersion())
    .rejects.toThrow('name is a required parameter');
});
