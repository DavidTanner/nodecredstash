const AWS = require('aws-sdk-mock');
const { defCredstash } = require('./utils/general');

beforeEach(() => {
  AWS.restore();
});

afterEach(() => {
  AWS.restore();
});

test('should reject non integer versions', () => {
  AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(
    undefined,
    {
      Items: [
        {
          version: 'hello world',
        },
      ],
    } // eslint-disable-line comma-dangle
  ));
  const credstash = defCredstash();
  return credstash.incrementVersion({ name: 'name' })
    .then(() => 'Should not get here')
    .catch((err) => {
      expect(err.message).toContain('is not an int');
    });
});

test('should return a padded version integer', async () => {
  AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(
    undefined,
    { Items: [{ version: '1' }] },
  ));
  const credstash = defCredstash();
  await expect(credstash.incrementVersion({ name: 'name' })).resolves.toBe('0000000000000000002');
});

test('should accept name as a param', async () => {
  const name = 'name';
  AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
    expect(params.ExpressionAttributeValues).toEqual({ ':name': name });
    cb(undefined, {
      Items: [
        {
          version: '1',
        },
      ],
    });
  });
  const credstash = defCredstash();
  await expect(credstash.incrementVersion({ name })).resolves.toBe('0000000000000000002');
});
