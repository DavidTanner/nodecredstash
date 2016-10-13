'use strict';

/* eslint-disable no-unused-expressions, no-undef */

require('../../test/setup');
const AWS = require('aws-sdk-mock');
const KMS = require('../kms');


describe('kms', () => {
  describe('#decrypt', () => {
    it('should call decrypt with key and context', () => {
      const key = 'key';
      const context = { key: 'value' };
      AWS.mock('KMS', 'decrypt', (params, cb) => {
        expect(params.CiphertextBlob).to.exist;
        params.CiphertextBlob.should.equal(key);
        expect(params.EncryptionContext).to.exist;
        params.EncryptionContext.should.equal(context);
        cb();
      });
      const kms = new KMS();
      return kms.decrypt(key, context);
    });
  });

  describe('#getEncryptionKey', () => {
    it('should call getEncryptionKey with correct params', () => {
      const key = 'key';
      const context = { key: 'value' };
      AWS.mock('KMS', 'generateDataKey', (params, cb) => {
        expect(params.NumberOfBytes).to.exist;
        params.NumberOfBytes.should.equal(64);
        expect(params.EncryptionContext).to.exist;
        params.EncryptionContext.should.equal(context);
        expect(params.KeyId).to.exist;
        params.KeyId.should.equal(key);
        cb();
      });
      const kms = new KMS(key);
      return kms.getEncryptionKey(context);
    });
  });
});
