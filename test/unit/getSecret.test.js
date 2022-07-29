const AWS = require('aws-sdk-mock');
const encryption = require('./utils/encryption');
const { defCredstash } = require('./utils/general');

beforeEach(() => {
  AWS.restore();
});

afterEach(() => {
  AWS.restore();
});

test('should fetch and decode a secret', async () => {
  const name = 'name';
  const version = 'version1';
  const rawItem = encryption.credstashKey;
  AWS.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
    expect(params.Key).toHaveProperty('name', name);
    expect(params.Key).toHaveProperty('version', version);
    cb(undefined, {
      Item: {
        contents: rawItem.contents,
        key: rawItem.key,
        hmac: rawItem.hmac,
      },
    });
  });
  AWS.mock('KMS', 'decrypt', (params, cb) => {
    expect(params.CiphertextBlob).toEqual(rawItem.kms.CiphertextBlob);
    cb(undefined, rawItem.kms);
  });

  const credentials = defCredstash();
  await expect(credentials.getSecret({
    name,
    version,
  })).resolves.toBe(rawItem.plainText);
});

test.each([
  undefined,
  { version: 'version' },
])('%# should reject a missing name', async (params) => {
  const credentials = defCredstash();
  await expect(credentials.getSecret(params))
    .rejects.toThrow('name is a required parameter');
});

test('should not reject a missing version', async () => {
  const version = 'version1';
  const rawItem = encryption.credstashKey;
  AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
    cb(undefined, {
      Items: [
        {
          contents: rawItem.contents,
          key: rawItem.key,
          hmac: rawItem.hmac,
          version,
        },
      ],
    });
  });
  AWS.mock('KMS', 'decrypt', (params, cb) => {
    cb(undefined, rawItem.kms);
  });
  const credentials = defCredstash();
  await expect(credentials.getSecret({ name: 'name' })).resolves.toBe(rawItem.plainText);
});

test('should default version to the latest', async () => {
  const name = 'name';
  const rawItem = encryption.credstashKey;
  AWS.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
    cb(new Error('Error'));
  });
  AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
    expect(params.ExpressionAttributeValues).toHaveProperty(':name', name);
    cb(undefined, {
      Items: [
        {
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
  await expect(credentials.getSecret({
    name: 'name',
  }))
    .resolves.toBe(rawItem.plainText);
});

test('should throw an exception for a missing key', async () => {
  const name = 'name';
  const version = 'version1';
  const rawItem = encryption.credstashKey;
  AWS.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
    cb(undefined, {
      Item: {
        contents: rawItem.contents,
        hmac: rawItem.hmac,
      },
    });
  });
  AWS.mock('KMS', 'decrypt', (params, cb) => {
    cb(new Error('Error'));
  });

  const credentials = defCredstash();
  await expect(credentials.getSecret({
    name,
    version,
  })).rejects.toThrow('could not be found');
});

test('should throw an exception for invalid cipherText, no context', async () => {
  const name = 'name';
  const version = 'version1';
  const rawItem = encryption.credstashKey;
  AWS.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
    cb(undefined, {
      Item: {
        contents: rawItem.contents,
        hmac: rawItem.hmac,
        key: rawItem.key,
      },
    });
  });
  AWS.mock('KMS', 'decrypt', (params, cb) => {
    cb({ code: 'InvalidCiphertextException' });
  });

  const credentials = defCredstash();
  await expect(credentials.getSecret({
    name,
    version,
  })).rejects.toThrow('The credential may require that an encryption');
});

test('should throw an exception for invalid cipherText, with context', async () => {
  const name = 'name';
  const version = 'version1';
  const rawItem = encryption.credstashKey;
  AWS.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
    cb(undefined, {
      Item: {
        contents: rawItem.contents,
        hmac: rawItem.hmac,
        key: rawItem.key,
      },
    });
  });
  AWS.mock('KMS', 'decrypt', (params, cb) => {
    cb({ code: 'InvalidCiphertextException' });
  });

  const credentials = defCredstash();
  await expect(credentials.getSecret({
    name,
    version,
    context: {
      key: 'value',
    },
  })).rejects.toThrow('The encryption context provided may not match');
});

test('should throw an exception for invalid cipherText, with context', async () => {
  const name = 'name';
  const version = 'version1';
  const rawItem = encryption.credstashKey;
  AWS.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
    cb(undefined, {
      Item: {
        contents: rawItem.contents,
        hmac: rawItem.hmac,
        key: rawItem.key,
      },
    });
  });
  AWS.mock('KMS', 'decrypt', (params, cb) => {
    cb(new Error('Correct Error'));
  });

  const credentials = defCredstash();
  await expect(credentials.getSecret({
    name,
    version,
    context: {
      key: 'value',
    },
  })).rejects.toThrow('Decryption error');
});
