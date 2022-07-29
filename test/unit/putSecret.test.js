const AWS = require('aws-sdk-mock');
const encryption = require('./utils/encryption');
const { defCredstash } = require('./utils/general');

let realOne;

beforeEach(() => {
  AWS.restore();
  realOne = Object.assign({}, encryption.credstashKey);
});

afterEach(() => {
  AWS.restore();
});

test('should create a new stash', async () => {
  AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(undefined, realOne.kms));
  AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => {
    expect(params.Item).toEqual(expect.objectContaining({
      hmac: realOne.hmac,
      key: realOne.key,
      name: realOne.name,
      contents: realOne.contents,
      version: realOne.version,
      digest: realOne.digest,
    }));
    cb(undefined, 'Success');
  });
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
    version: realOne.version,
  })).resolves.toEqual('Success');
});

test('should default the version to a zero padded 1', async () => {
  AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(undefined, realOne.kms));
  AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => {
    expect(params.Item).toHaveProperty('version', '0000000000000000001');
    cb(undefined, 'Success');
  });
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  })).resolves.toBe('Success');
});

test('should convert numerical versions to padded strings', async () => {
  AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(undefined, realOne.kms));
  AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => {
    expect(params.Item).toHaveProperty('version', '0000000000000000042');
    cb(undefined, 'Success');
  });
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
    version: 42,
  })).resolves.toBe('Success');
});

test('should default the digest to SHA256', async () => {
  AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(undefined, realOne.kms));
  AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => {
    expect(params.Item).toHaveProperty('digest', 'SHA256');
    cb(undefined, 'Success');
  });
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  })).resolves.toBe('Success');
});

test('should use the correct context', async () => {
  const context = { key: 'value' };
  AWS.mock('KMS', 'generateDataKey', (params, cb) => {
    expect(params.EncryptionContext).toEqual(context);
    cb(undefined, realOne.kms);
  });
  AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => cb(undefined, 'Success'));
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
    version: realOne.version,
    context,
  })).resolves.toBe('Success');
});

test('should use the provided digest', async () => {
  const digest = 'MD5';
  AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(undefined, realOne.kms));
  AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => {
    expect(params.Item.digest).toBe(digest);
    cb(undefined, 'Success');
  });
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
    version: realOne.version,
    digest,
  })).resolves.toBe('Success');
});

test('should rethrow a NotFoundException from KMS', async () => {
  AWS.mock('KMS', 'generateDataKey', (params, cb) => cb({
    code: 'NotFoundException',
    message: 'Success',
    random: 1234,
  }));
  AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => cb(new Error('Error')));
  const credstash = defCredstash();
  return credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  })
    .then((res) => expect(res).toBeUndefined())
    .catch((err) => {
      expect(err.message).toBe('Success');
      expect(err.code).toBe('NotFoundException');
      expect(err.random).toBe(1234);
    });
});

test('should throw an error for a bad KMS key', async () => {
  AWS.mock('KMS', 'generateDataKey', (params, cb) => cb({
    code: 'Key Exception of some other sort',
    message: 'Failure',
  }));
  AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => cb(new Error('Error')));
  const credstash = defCredstash({
    kmsKey: 'test',
  });
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  })).rejects.toThrowError('Could not generate key using KMS key test');
});

test('should notify of duplicate name/version pairs', async () => {
  AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(undefined, realOne.kms));
  AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => cb({
    code: 'ConditionalCheckFailedException',
  }));
  const credstash = defCredstash({
    kmsKey: 'test',
  });
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  })).rejects.toThrow('is already in the credential store.');
});

test.each([
  undefined,
  {},
  { secret: 'secret' },
])('%# should reject missing name', async (putSecretParams) => {
  AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(new Error('Error')));
  const credstash = defCredstash();
  await expect(credstash.putSecret(putSecretParams)).rejects.toThrow('name is a required parameter');
});

test('should reject a missing secret', async () => {
  AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(new Error('Error')));
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: 'name',
  })).rejects.toThrow('secret is a required parameter');
});
