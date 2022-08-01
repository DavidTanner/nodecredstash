const { KMSClient, DecryptCommand, GenerateDataKeyCommand } = require('@aws-sdk/client-kms');

function KMS(kmsKey, awsOpts) {
  const kms = new KMSClient(awsOpts);

  this.decrypt = async (key, context) => {
    const cmd = new DecryptCommand({
      CiphertextBlob: key,
      EncryptionContext: context,
    });
    const result = await kms.send(cmd);
    return result;
  };

  this.getEncryptionKey = async (context) => {
    const cmd = new GenerateDataKeyCommand({
      NumberOfBytes: 64,
      EncryptionContext: context,
      KeyId: kmsKey,
    });

    const result = await kms.send(cmd);
    return result;
  };
}

module.exports = KMS;
