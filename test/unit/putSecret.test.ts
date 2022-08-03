import { ConditionalCheckFailedException, TableNotFoundException } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { GenerateDataKeyCommand, NotFoundException, KMSInternalException } from '@aws-sdk/client-kms';
import { credStashKey, StaticData } from './utils/encryption';
import { mockKms, mockDocClient } from './utils/awsSdk';
import { CredStash } from '../../src';

let realOne: StaticData;
const credStash = new CredStash();

const response = {};

beforeEach(() => {
  realOne = Object.assign({}, credStashKey);
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
  ).resolves(response);
  await expect(credStash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
    version: realOne.version,
  })).resolves.toEqual(response);
});

test('should default the version to a zero padded 1', async () => {
  mockKms.on(GenerateDataKeyCommand).resolves(realOne.kms);
  mockDocClient.on(PutCommand, { Item: { version: '0000000000000000001' } }).resolves(response);
  await expect(credStash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  })).resolves.toBe(response);
});

test('should convert numerical versions to padded strings', async () => {
  mockKms.on(GenerateDataKeyCommand).resolves(realOne.kms);
  mockDocClient.on(PutCommand, { Item: { version: '0000000000000000042' } }).resolves(response);
  await expect(credStash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
    version: 42,
  })).resolves.toBe(response);
});

test('should default the digest to SHA256', async () => {
  mockKms.on(GenerateDataKeyCommand).resolves(realOne.kms);
  mockDocClient.on(PutCommand, { Item: { digest: 'SHA256' } }).resolves(response);
  await expect(credStash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  })).resolves.toBe(response);
});

test('should use the correct context', async () => {
  const context = { key: 'value' };
  mockKms.on(GenerateDataKeyCommand, { EncryptionContext: context }).resolves(realOne.kms);
  mockDocClient.on(PutCommand).resolves(response);
  await expect(credStash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
    version: realOne.version,
    context,
  })).resolves.toBe(response);
});

test('should use the provided digest', async () => {
  const digest = 'MD5';
  mockKms.on(GenerateDataKeyCommand).resolves(realOne.kms);
  mockDocClient.on(PutCommand, { Item: { digest } }).resolves(response);
  await expect(credStash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
    version: realOne.version,
    digest,
  })).resolves.toBe(response);
});

test('should rethrow a NotFoundException from KMS', async () => {
  const error = new NotFoundException(
    // @ts-expect-error
    {},
  );
  mockKms.on(GenerateDataKeyCommand).rejects(error);
  await expect(credStash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  }))
    .rejects.toThrow(error);
  expect(mockDocClient.commandCalls(PutCommand)).toHaveLength(0);
});

test('should throw an error for a bad KMS key', async () => {
  mockKms.on(GenerateDataKeyCommand).rejects(new KMSInternalException(
    // @ts-expect-error
    { message: 'Failure' },
  ));
  mockDocClient.on(PutCommand).rejects(new Error('Error'));
  await expect(credStash.putSecret({
    kmsKey: 'test',
    name: realOne.name,
    secret: realOne.plainText,
  })).rejects.toThrowError('Could not generate key using KMS key test');
});

test('should notify of duplicate name/version pairs', async () => {
  mockKms.on(GenerateDataKeyCommand).resolves(realOne.kms);
  mockDocClient.on(PutCommand).rejects(new ConditionalCheckFailedException(
    // @ts-expect-error
    {},
  ));
  await expect(credStash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  })).rejects.toThrow('is already in the credential store.');
});

test('should throw other DDB errors', async () => {
  const error = new TableNotFoundException(
    // @ts-expect-error
    {},
  );
  mockKms.on(GenerateDataKeyCommand).resolves(realOne.kms);
  mockDocClient.on(PutCommand).rejects(error);
  await expect(credStash.putSecret({
    name: realOne.name,
    secret: realOne.plainText,
  })).rejects.toThrow(error);
});
