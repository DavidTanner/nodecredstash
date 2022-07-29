const AWS = require('aws-sdk-mock');
const { defCredstash } = require('./utils/general');

beforeEach(() => {
  AWS.restore();
});

afterEach(() => {
  AWS.restore();
});

const name = 'name';
const version = 'version';
const numVer = 42;

test.each([
  [undefined, 'name'],
  [{}, 'name'],
  [{ name: 'name' }, 'version'],
])('%# should reject missing params', async (deleteParams, missingParam) => {
  AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => cb(new Error('Error')));

  const credstash = defCredstash();
  await expect(credstash.deleteSecret(deleteParams)).rejects.toThrow(`${missingParam} is a required parameter`);
});

test('should delete the correct item', async () => {
  AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => {
    expect(params.Key).toHaveProperty(name, name);
    expect(params.Key).toHaveProperty(version, version);
    cb(undefined, 'Success');
  });

  const credstash = defCredstash();
  await expect(credstash.deleteSecret({ name, version })).resolves.toBe('Success');
});

test('should convert numerical versions into strings', async () => {
  AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => {
    expect(params.Key).toHaveProperty(name, name);
    expect(params.Key).toHaveProperty(version, `00000000000000000${numVer}`);
    cb(undefined, 'Success');
  });

  const credstash = defCredstash();
  await expect(credstash.deleteSecret({ name, version: numVer })).resolves.toBe('Success');
});
