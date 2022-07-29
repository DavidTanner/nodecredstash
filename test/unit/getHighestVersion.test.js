const AWS = require('aws-sdk-mock');
const { defCredstash } = require('./utils/general');

beforeEach(() => {
  AWS.restore();
});

afterEach(() => {
  AWS.restore();
});

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
  AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(undefined, { Items }));
  const credstash = defCredstash();
  await expect(credstash.getHighestVersion({
    name: 'name1',
  })).resolves.toBe(Items[0].version);
});

test('should default to version 0', async () => {
  AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(undefined, { Items: [] }));
  const credstash = defCredstash();
  await expect(credstash.getHighestVersion({
    name: 'name',
  })).resolves.toBe(0);
});

test('should request by name', async () => {
  const name = 'name';
  AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
    expect(params.ExpressionAttributeValues).toEqual({
      ':name': name,
    });
    cb(undefined, {
      Items: [],
    });
  });
  const credstash = defCredstash();
  await expect(credstash.getHighestVersion({
    name: 'name',
  })).resolves.toBe(0);
});

test('should reject a missing name', async () => {
  AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(new Error('Error')));
  const credstash = defCredstash();
  await expect(credstash.getHighestVersion())
    .rejects.toThrow('name is a required parameter');
});
