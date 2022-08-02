const { ulid } = require('ulid');
const { randomBytes } = require('crypto');
const {
  DecryptCommand,
  InvalidCiphertextException,
  NotFoundException,
  GenerateDataKeyCommand,
} = require('@aws-sdk/client-kms');

const { KeyService } = require('../../../src/lib/keyService');

const { mockKms } = require('../utils/awsSdk');

const KeyId = ulid();

const EncryptionContext = { [ulid()]: ulid() };
const withContext = new KeyService(mockKms, KeyId, EncryptionContext);
const withOutContext = new KeyService(mockKms, KeyId);

describe('#generateDataKey', () => {
  const cipherText = Buffer.from(ulid());
  const plainText = randomBytes(64);
  const NumberOfBytes = 64;

  const expectedCalls = (iWith, iWithout) => {
    expect(mockKms.commandCalls(GenerateDataKeyCommand)).toHaveLength(iWith + iWithout);
    expect(mockKms.commandCalls(
      GenerateDataKeyCommand,
      { KeyId, NumberOfBytes, EncryptionContext },
    )).toHaveLength(iWith);

    expect(mockKms.commandCalls(
      GenerateDataKeyCommand,
      { KeyId, NumberOfBytes, EncryptionContext: undefined },
    )).toHaveLength(iWithout);
  };

  test('will return the Plaintext attribute', async () => {
    const expected = { key: plainText, encodedKey: cipherText };
    mockKms.on(GenerateDataKeyCommand).resolves({
      Plaintext: plainText,
      CiphertextBlob: cipherText,
    });

    await expect(withContext.generateDataKey(NumberOfBytes)).resolves.toEqual(expected);
    expectedCalls(1, 0);

    await expect(withOutContext.generateDataKey(NumberOfBytes)).resolves.toEqual(expected);
    expectedCalls(1, 1);
  });

  test('will throw NotFoundException', async () => {
    const error = new NotFoundException();
    mockKms.on(GenerateDataKeyCommand).rejects(error);
    await expect(withContext.generateDataKey(NumberOfBytes)).rejects.toThrow(error);
    expectedCalls(1, 0);

    await expect(withOutContext.generateDataKey(NumberOfBytes)).rejects.toThrow(error);
    expectedCalls(1, 1);
  });

  test('will wrap other errors', async () => {
    const error = new Error(ulid());
    const msg = `Could not generate key using KMS key ${KeyId} (Details: ${
      JSON.stringify(error, null, 2)
    })`;
    mockKms.on(GenerateDataKeyCommand).rejects(error);
    await expect(withContext.generateDataKey(NumberOfBytes)).rejects.toThrow(msg);
    expectedCalls(1, 0);

    await expect(withOutContext.generateDataKey(NumberOfBytes)).rejects.toThrow(msg);
    expectedCalls(1, 1);
  });
});

describe('#decrypt', () => {
  const cipherText = Buffer.from(ulid());
  const plainText = randomBytes(64);

  const expectedCalls = (iWith, iWithout) => {
    expect(mockKms.commandCalls(DecryptCommand)).toHaveLength(iWith + iWithout);
    expect(mockKms.commandCalls(
      DecryptCommand,
      { CiphertextBlob: cipherText, EncryptionContext },
    )).toHaveLength(iWith);
    expect(mockKms.commandCalls(
      DecryptCommand,
      { CiphertextBlob: cipherText, EncryptionContext: undefined },
    )).toHaveLength(iWithout);
  };

  test('will return the Plaintext attribute', async () => {
    mockKms.on(DecryptCommand).resolves({ Plaintext: plainText });

    await expect(withContext.decrypt(cipherText)).resolves.toBe(plainText);
    expectedCalls(1, 0);

    await expect(withOutContext.decrypt(cipherText)).resolves.toBe(plainText);
    expectedCalls(1, 1);
  });

  test('should throw an exception for invalid cipherText', async () => {
    mockKms.on(DecryptCommand).rejects(new InvalidCiphertextException());

    await expect(withContext.decrypt(cipherText)).rejects.toThrow(
      'Could not decrypt hmac key with KMS. The encryption '
      + 'context provided may not match the one used when the '
      + 'credential was stored.',
    );
    expectedCalls(1, 0);

    await expect(withOutContext.decrypt(cipherText)).rejects.toThrow(
      'Could not decrypt hmac key with KMS. The credential may '
      + 'require that an encryption context be provided to decrypt '
      + 'it.',
    );
    expectedCalls(1, 1);
  });

  test('will throw other exceptions', async () => {
    const error = new NotFoundException();
    mockKms.on(DecryptCommand).rejects(error);
    await expect(withContext.decrypt(cipherText)).rejects.toThrow(error);
    expectedCalls(1, 0);
    await expect(withOutContext.decrypt(cipherText)).rejects.toThrow(error);
    expectedCalls(1, 1);
  });

  test('will throw other exceptions', async () => {
    const error = new Error(ulid());
    const msg = `Decryption error: ${JSON.stringify(error, null, 2)}`;
    mockKms.on(DecryptCommand).rejects(error);
    await expect(withContext.decrypt(cipherText)).rejects.toThrow(msg);
    expectedCalls(1, 0);
    await expect(withOutContext.decrypt(cipherText)).rejects.toThrow(msg);
    expectedCalls(1, 1);
  });
});
