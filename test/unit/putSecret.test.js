const { ConditionalCheckFailedException } = require('@aws-sdk/client-dynamodb');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { GenerateDataKeyCommand, NotFoundException, KMSInternalException } = require('@aws-sdk/client-kms');
const encryption = require('./utils/encryption');
const { defCredstash } = require('./utils/general');
const { mockKms, mockDocClient } = require('./utils/awsSdk');

let realOne;

beforeEach(() => {
  realOne = Object.assign({}, encryption.credstashKey);
});

test('should create a new stash', async () => {
  mockKms.on(GenerateDataKeyCommand).resolves(realOne.kms);
  mockDocClient.on(
    PutCommand,
    {
      Item: {
        hmac: realOne.hmac,
        key: realOne.key,
        name: realOne.name,
        contents: realOne.contents,
        version: realOne.version,
        digest: realOne.digest,
      },
    },
  ).resolves('Success');
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
    version: realOne.version,
  })).resolves.toEqual('Success');
});

test('should default the version to a zero padded 1', async () => {
  mockKms.on(GenerateDataKeyCommand).resolves(realOne.kms);
  mockDocClient.on(PutCommand, { Item: { version: '0000000000000000001' } }).resolves('Success');
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  })).resolves.toBe('Success');
});

test('should convert numerical versions to padded strings', async () => {
  mockKms.on(GenerateDataKeyCommand).resolves(realOne.kms);
  mockDocClient.on(PutCommand, { Item: { version: '0000000000000000042' } }).resolves('Success');
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
    version: 42,
  })).resolves.toBe('Success');
});

test('should default the digest to SHA256', async () => {
  mockKms.on(GenerateDataKeyCommand).resolves(realOne.kms);
  mockDocClient.on(PutCommand, { Item: { digest: 'SHA256' } }).resolves('Success');
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  })).resolves.toBe('Success');
});

test('should use the correct context', async () => {
  const context = { key: 'value' };
  mockKms.on(GenerateDataKeyCommand, { EncryptionContext: context }).resolves(realOne.kms);
  mockDocClient.on(PutCommand).resolves('Success');
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
  mockKms.on(GenerateDataKeyCommand).resolves(realOne.kms);
  mockDocClient.on(PutCommand, { Item: { digest } }).resolves('Success');
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
    version: realOne.version,
    digest,
  })).resolves.toBe('Success');
});

test('should rethrow a NotFoundException from KMS', async () => {
  const error = new NotFoundException();
  mockKms.on(GenerateDataKeyCommand).rejects(error);
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  }))
    .rejects.toThrow(error);
  expect(mockDocClient.commandCalls(PutCommand)).toHaveLength(0);
});

test('should throw an error for a bad KMS key', async () => {
  mockKms.on(GenerateDataKeyCommand).rejects(new KMSInternalException({ message: 'Failure' }));
  mockDocClient.on(PutCommand).rejects(new Error('Error'));
  const credstash = defCredstash({
    kmsKey: 'test',
  });
  await expect(credstash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  })).rejects.toThrowError('Could not generate key using KMS key test');
});

test('should notify of duplicate name/version pairs', async () => {
  mockKms.on(GenerateDataKeyCommand).resolves(realOne.kms);
  mockDocClient.on(PutCommand).rejects(new ConditionalCheckFailedException());
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
  const credstash = defCredstash();
  await expect(credstash.putSecret(putSecretParams)).rejects.toThrow('name is a required parameter');
  expect(mockKms.commandCalls(GenerateDataKeyCommand)).toHaveLength(0);
});

test('should reject a missing secret', async () => {
  const credstash = defCredstash();
  await expect(credstash.putSecret({
    name: 'name',
  })).rejects.toThrow('secret is a required parameter');
  expect(mockKms.commandCalls(GenerateDataKeyCommand)).toHaveLength(0);
});
