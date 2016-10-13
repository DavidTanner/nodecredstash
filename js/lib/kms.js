'use strict';

const AWS = require('aws-sdk');

const utils = require('./utils');

function KMS(kmsKey, awsOpts) {
  const kms = new AWS.KMS(awsOpts);

  this.decrypt = (key, context) => {
    const params = {
      CiphertextBlob: key,
      EncryptionContext: context,
    };

    return utils.asPromise(kms, kms.decrypt, params);
  };

  this.getEncryptionKey = (context) => {
    const params = {
      NumberOfBytes: 64,
      EncryptionContext: context,
      KeyId: kmsKey,
    };

    return utils.asPromise(kms, kms.generateDataKey, params);
  };
}

module.exports = KMS;
