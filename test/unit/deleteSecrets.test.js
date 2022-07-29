const AWS = require('aws-sdk-mock');
const { defCredstash } = require('./utils/general');

beforeEach(() => {
  AWS.restore();
});

afterEach(() => {
  AWS.restore();
});

test.each([
  undefined,
  {},
])('%# should reject empty options', async (params) => {
  AWS.mock('DynamoDB.DocumentClient', 'query', (_, cb) => cb(new Error('Error')));
  AWS.mock('DynamoDB.DocumentClient', 'delete', (_, cb) => cb(new Error('Error')));
  const credstash = defCredstash();
  await expect(credstash.deleteSecrets(params)).rejects.toThrow('name is a required parameter');
});

test('should delete all versions of a given name', async () => {
  const name = 'name';
  const Items = Array.from({ length: 10 }, (v, i) => ({ name, version: `${i}` }));
  AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
    expect(params.ExpressionAttributeValues).toHaveProperty(':name', name);
    cb(undefined, { Items });
  });
  let counter = 0;
  AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => {
    expect(params.Key).toHaveProperty('name', name);
    expect(params.Key).toHaveProperty('version', `${counter}`);
    counter += 1;
    cb(undefined, 'Success');
  });

  const credstash = defCredstash();
  await expect(credstash.deleteSecrets({ name })).resolves.toEqual(Items.map(() => 'Success'));
});
