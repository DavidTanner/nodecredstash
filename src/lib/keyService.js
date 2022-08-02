const {
  GenerateDataKeyCommand,
  DecryptCommand,
  InvalidCiphertextException,
  NotFoundException,
} = require('@aws-sdk/client-kms');

class KeyService {
  constructor(
    kms,
    keyId,
    encryptionContext,
  ) {
    this.kms = kms;
    this.keyId = keyId;
    this.encryptionContext = encryptionContext;
  }

  async generateDataKey(NumberOfBytes) {
    try {
      const result = await this.kms.send(new GenerateDataKeyCommand({
        KeyId: this.keyId,
        EncryptionContext: this.encryptionContext,
        NumberOfBytes,
      }));
      return {
        key: result.Plaintext,
        encodedKey: result.CiphertextBlob,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Could not generate key using KMS key ${this.keyId} (Details: ${
        JSON.stringify(error, null, 2)
      })`);
    }
  }

  async decrypt(ciphertext) {
    try {
      const response = await this.kms.send(new DecryptCommand({
        CiphertextBlob: Buffer.from(ciphertext, 'base64'),
        EncryptionContext: this.encryptionContext,
      }));
      return response.Plaintext;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      let msg = `Decryption error: ${JSON.stringify(error, null, 2)}`;
      if (error instanceof InvalidCiphertextException) {
        if (this.encryptionContext) {
          msg = 'Could not decrypt hmac key with KMS. The encryption '
            + 'context provided may not match the one used when the '
            + 'credential was stored.';
        } else {
          msg = 'Could not decrypt hmac key with KMS. The credential may '
            + 'require that an encryption context be provided to decrypt '
            + 'it.';
        }
      }
      throw new Error(msg);
    }
  }
}

module.exports = {
  KeyService,
};
