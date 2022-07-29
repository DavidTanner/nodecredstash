const AWS = require('aws-sdk-mock');
const encryption = require('./utils/encryption');
const { defCredstash } = require('./utils/general');

beforeEach(() => {
  AWS.restore();
});

afterEach(() => {
  AWS.restore();
});

test('should reject requests without a name', async () => {
  const limit = 5;
  const credstash = defCredstash();
  await expect(credstash.getAllVersions({
    limit,
  })).rejects.toThrow('name is a required parameter');
});

test('should fetch and decode the secrets', async () => {
  const name = 'name';
  const limit = 5;
  const rawItem = encryption.credstashKey;

  AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
    expect(params.ExpressionAttributeValues).toHaveProperty(':name', name);
    expect(params.Limit).toBe(limit);
    cb(undefined, {
      Items: [
        {
          version: '0000000000000000006',
          contents: rawItem.contents,
          key: rawItem.key,
          hmac: rawItem.hmac,
        },
      ],
    });
  });

  AWS.mock('KMS', 'decrypt', (params, cb) => {
    expect(params.CiphertextBlob).toEqual(rawItem.kms.CiphertextBlob);
    cb(undefined, rawItem.kms);
  });

  const credentials = defCredstash();
  return credentials.getAllVersions({
    name,
    limit,
  }).then((allVersions) => {
    expect(allVersions[0]).toHaveProperty('version', '0000000000000000006');
    expect(allVersions[0]).toHaveProperty('secret', rawItem.plainText);
  });
});

test('should default to all versions', () => {
  const name = 'name';
  const rawItem = encryption.credstashKey;

  AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
    expect(params.ExpressionAttributeValues).toHaveProperty(':name', name);
    expect(params.Limit).toBeUndefined();
    cb(undefined, {
      Items: [
        {
          version: '0000000000000000006',
          contents: rawItem.contents,
          key: rawItem.key,
          hmac: rawItem.hmac,
        },
      ],
    });
  });

  AWS.mock('KMS', 'decrypt', (params, cb) => {
    expect(params.CiphertextBlob).toEqual(rawItem.kms.CiphertextBlob);
    cb(undefined, rawItem.kms);
  });

  const credentials = defCredstash();
  return credentials.getAllVersions({
    name,
  }).then((allVersions) => {
    expect(allVersions[0]).toHaveProperty('version', '0000000000000000006');
    expect(allVersions[0]).toHaveProperty('secret', rawItem.plainText);
  });
});
