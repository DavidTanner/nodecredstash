import { describe, test, expect } from 'vitest';
import { randomBytes, randomUUID } from 'crypto';
import {
  DecryptCommand,
  InvalidCiphertextException,
  NotFoundException,
  GenerateDataKeyCommand, KMSClient,
} from '@aws-sdk/client-kms';

import { KeyService } from '../../../src/lib/keyService';

import { mockKms } from '../utils/awsSdk';
import { DEFAULT_KMS_KEY } from '../../../src/defaults';

const KeyId = randomUUID();
const kms = new KMSClient({});

const EncryptionContext = { [randomUUID()]: randomUUID() };
const withContext = new KeyService(kms, KeyId, EncryptionContext);
const withOutContext = new KeyService(kms, KeyId);
const withDefaults = new KeyService(kms);

describe('#generateDataKey', () => {
  const cipherText = Buffer.from(randomUUID());
  const plainText = randomBytes(64);
  const NumberOfBytes = 64;

  const expectedCalls = (iWith: number, iWithoutContext: number, iWithDefaults: number) => {
    expect(mockKms.commandCalls(GenerateDataKeyCommand)).toHaveLength(
      iWith + iWithoutContext + iWithDefaults,
    );
    expect(mockKms.commandCalls(
      GenerateDataKeyCommand,
      { KeyId, NumberOfBytes, EncryptionContext },
    )).toHaveLength(iWith);

    expect(mockKms.commandCalls(
      GenerateDataKeyCommand,
      { KeyId, NumberOfBytes, EncryptionContext: undefined },
    )).toHaveLength(iWithoutContext);

    expect(mockKms.commandCalls(
      GenerateDataKeyCommand,
      { KeyId: DEFAULT_KMS_KEY, NumberOfBytes, EncryptionContext: undefined },
    )).toHaveLength(iWithDefaults);
  };

  test('will return the Plaintext attribute', async () => {
    const expected = { key: plainText, encodedKey: cipherText };
    mockKms.on(GenerateDataKeyCommand).resolves({
      Plaintext: plainText,
      CiphertextBlob: cipherText,
    });

    await expect(withContext.generateDataKey(NumberOfBytes)).resolves.toEqual(expected);
    expectedCalls(1, 0, 0);

    await expect(withOutContext.generateDataKey(NumberOfBytes)).resolves.toEqual(expected);
    expectedCalls(1, 1, 0);

    await expect(withDefaults.generateDataKey(NumberOfBytes)).resolves.toEqual(expected);
    expectedCalls(1, 1, 1);
  });

  test('will throw NotFoundException', async () => {
    // @ts-expect-error
    const error = new NotFoundException();
    mockKms.on(GenerateDataKeyCommand).rejects(error);
    await expect(withContext.generateDataKey(NumberOfBytes)).rejects.toThrow(error);
    expectedCalls(1, 0, 0);

    await expect(withOutContext.generateDataKey(NumberOfBytes)).rejects.toThrow(error);
    expectedCalls(1, 1, 0);

    await expect(withDefaults.generateDataKey(NumberOfBytes)).rejects.toThrow(error);
    expectedCalls(1, 1, 1);
  });

  test('will wrap other errors', async () => {
    const error = new Error(randomUUID());
    const msg = `Could not generate key using KMS key ${KeyId} (Details: ${
      JSON.stringify(error, null, 2)
    })`;
    mockKms.on(GenerateDataKeyCommand).rejects(error);
    await expect(withContext.generateDataKey(NumberOfBytes)).rejects.toThrow(msg);
    expectedCalls(1, 0, 0);

    await expect(withOutContext.generateDataKey(NumberOfBytes)).rejects.toThrow(msg);
    expectedCalls(1, 1, 0);

    await expect(withDefaults.generateDataKey(NumberOfBytes)).rejects.toThrow(
      `Could not generate key using KMS key ${DEFAULT_KMS_KEY} (Details: ${
        JSON.stringify(error, null, 2)
      })`,
    );
    expectedCalls(1, 1, 1);
  });
});

describe('#decrypt', () => {
  const cipherText = Buffer.from(randomUUID());
  const plainText = randomBytes(64);

  const expectedCalls = (iWith: number, iWithout: number) => {
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

    await expect(withContext.decrypt(cipherText.toString('base64'))).resolves.toBe(plainText);
    expectedCalls(1, 0);

    await expect(withOutContext.decrypt(cipherText.toString('base64'))).resolves.toBe(plainText);
    expectedCalls(1, 1);
  });

  test('should throw an exception for invalid cipherText', async () => {
    // @ts-expect-error
    mockKms.on(DecryptCommand).rejects(new InvalidCiphertextException());

    await expect(withContext.decrypt(cipherText.toString('base64'))).rejects.toThrow(
      'Could not decrypt hmac key with KMS. The encryption '
      + 'context provided may not match the one used when the '
      + 'credential was stored.',
    );
    expectedCalls(1, 0);

    await expect(withOutContext.decrypt(cipherText.toString('base64'))).rejects.toThrow(
      'Could not decrypt hmac key with KMS. The credential may '
      + 'require that an encryption context be provided to decrypt '
      + 'it.',
    );
    expectedCalls(1, 1);
  });

  test('will throw NotFoundException as is', async () => {
    // @ts-expect-error
    const error = new NotFoundException();
    mockKms.on(DecryptCommand).rejects(error);
    await expect(withContext.decrypt(cipherText.toString('base64'))).rejects.toThrow(error);
    expectedCalls(1, 0);
    await expect(withOutContext.decrypt(cipherText.toString('base64'))).rejects.toThrow(error);
    expectedCalls(1, 1);
  });

  test('will throw other exceptions', async () => {
    const error = new Error(randomUUID());
    const msg = `Decryption error: ${JSON.stringify(error, null, 2)}`;
    mockKms.on(DecryptCommand).rejects(error);
    await expect(withContext.decrypt(cipherText.toString('base64'))).rejects.toThrow(msg);
    expectedCalls(1, 0);
    await expect(withOutContext.decrypt(cipherText.toString('base64'))).rejects.toThrow(msg);
    expectedCalls(1, 1);
  });
});
