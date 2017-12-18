'use strict';

/* eslint-disable no-unused-expressions, no-undef */

require('./setup');
const AWS = require('aws-sdk-mock');

const Credstash = require('../index');
const encryption = require('./utils/encryption');

const encrypter = require('../lib/encrypter');
const defaults = require('../defaults');


describe('index', () => {
  const defCredstash = options => new Credstash(Object.assign({ awsOpts: { region: 'us-east-1' } }, options));

  beforeEach(() => {
    AWS.restore();
  });

  afterEach(() => {
    AWS.restore();
  });

  describe('#constructor', () => {
    it('has methods to match credstash', () => {
      const credstash = defCredstash();
      credstash.paddedInt.should.exist;
      credstash.getHighestVersion.should.exist;
      credstash.listSecrets.should.exist;
      credstash.putSecret.should.exist;
      credstash.getAllSecrets.should.exist;
      credstash.getAllVersions.should.exist;
      credstash.getSecret.should.exist;
      credstash.deleteSecrets.should.exist;
      credstash.createDdbTable.should.exist;
    });

    it('should use a callback if provided', (done) => {
      const table = 'TableNameNonDefault';
      AWS.mock('DynamoDB', 'describeTable', (params, cb) => {
        params.TableName.should.equal(table);
        cb();
      });
      const credstash = defCredstash({ table });
      credstash.createDdbTable((err) => {
        expect(err).to.not.exist;
        done();
      });
    });

    it('should use a callback for errors, and not throw an exception', (done) => {
      const table = 'TableNameNonDefault';
      AWS.mock('DynamoDB', 'describeTable', (params, cb) => {
        params.TableName.should.equal(table);
        cb('Error');
      });
      const credstash = defCredstash({ table });
      credstash.createDdbTable((err) => {
        expect(err).to.exist;
        err.should.equal('Error');
      })
        .then(done);
    });

    it('should return the configuration', () => {
      const region = 'us-east-1';
      const credstash = defCredstash();
      const newConfig = credstash.getConfiguration();
      newConfig.should.eql({
        config: {
          awsOpts: {
            region,
          },
        },
        dynamoConfig: {
          table: defaults.DEFAULT_TABLE,
          opts: {
            region,
          },
        },
        kmsConfig: {
          kmsKey: defaults.DEFAULT_KMS_KEY,
          opts: {
            region,
          },
        },
      });
    });

    it('should allow separate options for KMS and DynamoDB', () => {
      const region = 'us-east-1';

      const dynamoOpts = {
        region: 'us-west-1',
        endpoint: 'https://service1.region.amazonaws.com',
      };

      const kmsOpts = {
        region: 'us-west-2',
        endpoint: 'https://service2.region.amazonaws.com',
      };

      const credstash = defCredstash({
        dynamoOpts,
        kmsOpts,
      });
      const newConfig = credstash.getConfiguration();
      newConfig.should.eql({
        config: {
          dynamoOpts,
          kmsOpts,
          awsOpts: {
            region,
          },
        },
        dynamoConfig: {
          table: defaults.DEFAULT_TABLE,
          opts: dynamoOpts,
        },
        kmsConfig: {
          kmsKey: defaults.DEFAULT_KMS_KEY,
          opts: kmsOpts,
        },
      });
    });
  });

  describe('#getHighestVersion', () => {
    it('should return the highest version', () => {
      const Items = [
        {
          name: 'name1',
          version: 'version1',
        },
        {
          name: 'name1',
          version: 'version2',
        },
      ];
      AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(undefined, { Items }));
      const credstash = defCredstash();
      return credstash.getHighestVersion({
        name: 'name1',
      })
        .then(version => version.should.equal(Items[0].version));
    });

    it('should default to version 0', () => {
      AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(undefined, { Items: [] }));
      const credstash = defCredstash();
      return credstash.getHighestVersion({
        name: 'name',
      })
        .then(version => version.should.equal(0));
    });

    it('should request by name', () => {
      const name = 'name';
      AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
        params.ExpressionAttributeValues.should.deep.equal({
          ':name': name,
        });
        cb(undefined, {
          Items: [],
        });
      });
      const credstash = defCredstash();
      return credstash.getHighestVersion({
        name: 'name',
      })
        .then(version => version.should.equal(0));
    });

    it('should reject a missing name', () => {
      AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(new Error('Error')));
      const credstash = defCredstash();
      return credstash.getHighestVersion()
        .then(() => {
          throw new Error('Error');
        })
        .catch(err => err.message.should.contain('name is a required parameter'));
    });
  });

  describe('#incrementVersion', () => {
    it('should reject non integer versions', () => {
      AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(
        undefined,
        {
          Items: [
            {
              version: 'hello world',
            },
          ],
        } // eslint-disable-line comma-dangle
      ));
      const credstash = defCredstash();
      return credstash.incrementVersion({ name: 'name' })
        .then(() => 'Should not get here')
        .catch((err) => {
          expect(err.message).to.exist;
          err.message.should.contain('is not an int');
        });
    });

    it('should return a padded version integer', () => {
      AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(
        undefined,
        { Items: [{ version: '1' }] } // eslint-disable-line comma-dangle
      ));
      const credstash = defCredstash();
      return credstash.incrementVersion({
        name: 'name',
      })
        .then(version => version.should.equal('0000000000000000002'));
    });

    it('should accept name as a param', () => {
      const name = 'name';
      AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
        params.ExpressionAttributeValues.should.deep.equal({ ':name': name });
        cb(undefined, {
          Items: [
            {
              version: '1',
            },
          ],
        });
      });
      const credstash = defCredstash();
      return credstash.incrementVersion({ name })
        .then(version => version.should.equal('0000000000000000002'));
    });
  });

  describe('#putSecret', () => {
    let realOne;
    beforeEach(() => {
      realOne = Object.assign({}, encryption.credstashKey);
    });

    it('should create a new stash', () => {
      AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(undefined, realOne.kms));
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => {
        params.Item.hmac.should.equal(realOne.hmac);
        params.Item.key.should.equal(realOne.key);
        params.Item.name.should.equal(realOne.name);
        params.Item.contents.should.equal(realOne.contents);
        params.Item.version.should.equal(realOne.version);
        params.Item.digest.should.equal(realOne.digest);
        cb(undefined, 'Success');
      });
      const credstash = defCredstash();
      return credstash.putSecret({
        name: realOne.name,
        secret: realOne.plainText,
        version: realOne.version,
      })
        .then(res => res.should.equal('Success'));
    });

    it('should default the version to a zero padded 1', () => {
      AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(undefined, realOne.kms));
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => {
        params.Item.version.should.equal('0000000000000000001');
        cb(undefined, 'Success');
      });
      const credstash = defCredstash();
      return credstash.putSecret({
        name: realOne.name,
        secret: realOne.plainText,
      })
        .then(res => res.should.equal('Success'));
    });

    it('should convert numerical versions to padded strings', () => {
      AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(undefined, realOne.kms));
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => {
        params.Item.version.should.equal('0000000000000000042');
        cb(undefined, 'Success');
      });
      const credstash = defCredstash();
      return credstash.putSecret({
        name: realOne.name,
        secret: realOne.plainText,
        version: 42,
      })
        .then(res => res.should.equal('Success'));
    });

    it('should default the digest to SHA256', () => {
      AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(undefined, realOne.kms));
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => {
        params.Item.digest.should.equal('SHA256');
        cb(undefined, 'Success');
      });
      const credstash = defCredstash();
      return credstash.putSecret({
        name: realOne.name,
        secret: realOne.plainText,
      })
        .then(res => res.should.equal('Success'));
    });

    it('should use the correct context', () => {
      const context = { key: 'value' };
      AWS.mock('KMS', 'generateDataKey', (params, cb) => {
        params.EncryptionContext.should.deep.equal(context);
        cb(undefined, realOne.kms);
      });
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => cb(undefined, 'Success'));
      const credstash = defCredstash();
      return credstash.putSecret({
        name: realOne.name,
        secret: realOne.plainText,
        version: realOne.version,
        context,
      })
        .then(res => res.should.equal('Success'));
    });

    it('should use the provided digest', () => {
      const digest = 'MD5';
      AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(undefined, realOne.kms));
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => {
        params.Item.digest.should.equal(digest);
        cb(undefined, 'Success');
      });
      const credstash = defCredstash();
      return credstash.putSecret({
        name: realOne.name,
        secret: realOne.plainText,
        version: realOne.version,
        digest,
      })
        .then(res => res.should.equal('Success'));
    });

    it('should rethrow a NotFoundException from KMS', () => {
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
        .then(res => expect(res).to.not.exist)
        .catch((err) => {
          err.message.should.equal('Success');
          err.code.should.equal('NotFoundException');
          err.random.should.equal(1234);
        });
    });

    it('should throw an error for a bad KMS key', () => {
      AWS.mock('KMS', 'generateDataKey', (params, cb) => cb({
        code: 'Key Exception of some other sort',
        message: 'Failure',
      }));
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => cb(new Error('Error')));
      const credstash = defCredstash({
        kmsKey: 'test',
      });
      return credstash.putSecret({
        name: realOne.name,
        secret: realOne.plainText,
      })
        .then(res => expect(res).to.not.exist)
        .catch(err => err.message.should.equal('Could not generate key using KMS key test'));
    });

    it('should notify of duplicate name/version pairs', () => {
      AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(undefined, realOne.kms));
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => cb({
        code: 'ConditionalCheckFailedException',
      }));
      const credstash = defCredstash({
        kmsKey: 'test',
      });
      return credstash.putSecret({
        name: realOne.name,
        secret: realOne.plainText,
      })
        .then(res => expect(res).to.not.exist)
        .catch(err => err.message.should.contain('is already in the credential store.'));
    });

    it('should reject missing options', () => {
      AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(new Error('Error')));
      const credstash = defCredstash();
      return credstash.putSecret()
        .catch(err => err.message.should.equal('name is a required parameter'));
    });

    it('should reject a missing name', () => {
      AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(new Error('Error')));
      const credstash = defCredstash();
      return credstash.putSecret({
        secret: 'secret',
      })
        .catch(err => err.message.should.equal('name is a required parameter'));
    });

    it('should reject a missing secret', () => {
      AWS.mock('KMS', 'generateDataKey', (params, cb) => cb(new Error('Error')));
      const credstash = defCredstash();
      return credstash.putSecret({
        name: 'name',
      })
        .then(() => { throw new Error('Error'); })
        .catch(err => err.message.should.equal('secret is a required parameter'));
    });
  });

  describe('#getAllVersions', () => {
    it('should reject requests without a name', () => {
      const limit = 5;
      const credstash = defCredstash();
      return credstash.getAllVersions({
        limit,
      })
        .then(() => { throw new Error('Error'); })
        .catch(err => err.message.should.equal('name is a required parameter'));
    });

    it('should fetch and decode the secrets', () => {
      const name = 'name';
      const limit = 5;
      const rawItem = encryption.credstashKey;

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
        params.ExpressionAttributeValues[':name'].should.equal(name);
        params.Limit.should.equal(limit);
        cb(undefined, {
          Items: [
            {
              version: '0000000000000000006',
              contents: rawItem.contents,
              key: rawItem.key,
              hmac: rawItem.hmac,
            },
          ],
        });
      });

      AWS.mock('KMS', 'decrypt', (params, cb) => {
        params.CiphertextBlob.should.deep.equal(rawItem.kms.CiphertextBlob);
        cb(undefined, rawItem.kms);
      });

      const credentials = defCredstash();
      return credentials.getAllVersions({
        name,
        limit,
      }).then((allVersions) => {
        allVersions[0].version.should.equal('0000000000000000006');
        allVersions[0].secret.should.equal(rawItem.plainText);
      });
    });

    it('should default to all versions', () => {
      const name = 'name';
      const rawItem = encryption.credstashKey;

      AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
        params.ExpressionAttributeValues[':name'].should.equal(name);
        expect(params.Limit).to.not.exist;
        cb(undefined, {
          Items: [
            {
              version: '0000000000000000006',
              contents: rawItem.contents,
              key: rawItem.key,
              hmac: rawItem.hmac,
            },
          ],
        });
      });

      AWS.mock('KMS', 'decrypt', (params, cb) => {
        params.CiphertextBlob.should.deep.equal(rawItem.kms.CiphertextBlob);
        cb(undefined, rawItem.kms);
      });

      const credentials = defCredstash();
      return credentials.getAllVersions({
        name,
      }).then((allVersions) => {
        allVersions[0].version.should.equal('0000000000000000006');
        allVersions[0].secret.should.equal(rawItem.plainText);
      });
    });
  });

  describe('#getSecret', () => {
    it('should fetch and decode a secret', () => {
      const name = 'name';
      const version = 'version1';
      const rawItem = encryption.credstashKey;
      AWS.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
        params.Key.name.should.equal(name);
        params.Key.version.should.equal(version);
        cb(undefined, {
          Item: {
            contents: rawItem.contents,
            key: rawItem.key,
            hmac: rawItem.hmac,
          },
        });
      });
      AWS.mock('KMS', 'decrypt', (params, cb) => {
        params.CiphertextBlob.should.deep.equal(rawItem.kms.CiphertextBlob);
        cb(undefined, rawItem.kms);
      });

      const credentials = defCredstash();
      return credentials.getSecret({
        name,
        version,
      })
        .then(secret => secret.should.equal(rawItem.plainText));
    });

    it('should reject a missing name', () => {
      const credentials = defCredstash();
      return credentials.getSecret({ version: 'version' })
        .then(() => {
          throw new Error('Should not succeed');
        })
        .catch(err => err.message.should.contain('name is a required parameter'));
    });

    it('should reject a missing name with default options', () => {
      const credentials = defCredstash();
      return credentials.getSecret()
        .then(() => {
          throw new Error('Should not succeed');
        })
        .catch(err => err.message.should.contain('name is a required parameter'));
    });

    it('should not reject a missing version', () => {
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
      return credentials.getSecret({ name: 'name' })
        .then(secret => secret.should.equal(rawItem.plainText))
        .catch(err => expect(err).to.not.exist);
    });

    it('should default version to the latest', () => {
      const name = 'name';
      const rawItem = encryption.credstashKey;
      AWS.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
        cb(new Error('Error'));
      });
      AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
        params.ExpressionAttributeValues[':name'].should.equal(name);
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
        params.CiphertextBlob.should.deep.equal(rawItem.kms.CiphertextBlob);
        cb(undefined, rawItem.kms);
      });
      const credentials = defCredstash();
      return credentials.getSecret({
        name: 'name',
      })
        .then(secret => secret.should.equal(rawItem.plainText))
        .catch(err => expect(err).to.not.exist);
    });

    it('should throw an exception for a missing key', () => {
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
      return credentials.getSecret({
        name,
        version,
      })
        .then(() => {
          throw new Error('Error');
        })
        .catch((err) => {
          expect(err.message).to.exist;
          err.message.should.contain('could not be found');
        });
    });

    it('should throw an exception for invalid cipherText, no context', () => {
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
      return credentials.getSecret({
        name,
        version,
      })
        .then(() => {
          throw new Error('Error');
        })
        .catch((err) => {
          expect(err.message).to.exist;
          err.message.should.contain('The credential may require that an encryption');
        });
    });

    it('should throw an exception for invalid cipherText, with context', () => {
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
      return credentials.getSecret({
        name,
        version,
        context: {
          key: 'value',
        },
      })
        .then(() => {
          throw new Error('Error');
        })
        .catch((err) => {
          expect(err.message).to.exist;
          err.message.should.contain('The encryption context provided may not match');
        });
    });

    it('should throw an exception for invalid cipherText, with context', () => {
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
      return credentials.getSecret({
        name,
        version,
        context: {
          key: 'value',
        },
      })
        .then(() => {
          throw new Error('Error');
        })
        .catch((err) => {
          expect(err.message).to.exist;
          err.message.should.contain('Decryption error');
        });
    });
  });

  describe('#deleteSecrets', () => {
    it('should reject empty options', () => {
      AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(new Error('Error')));
      AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => cb(new Error('Error')));
      const credstash = defCredstash();
      return credstash.deleteSecrets()
        .then(res => expect(res).to.not.exist)
        .catch(err => err.message.should.equal('name is a required parameter'));
    });

    it('should reject missing name', () => {
      AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => cb(new Error('Error')));
      AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => cb(new Error('Error')));
      const credstash = defCredstash();
      return credstash.deleteSecrets({})
        .then(res => expect(res).to.not.exist)
        .catch(err => err.message.should.equal('name is a required parameter'));
    });

    it('should delete all versions of a given name', () => {
      const name = 'name';
      const Items = Array.from({ length: 10 }, (v, i) => ({ name, version: `${i}` }));
      AWS.mock('DynamoDB.DocumentClient', 'query', (params, cb) => {
        params.ExpressionAttributeValues[':name'].should.equal(name);
        cb(undefined, { Items });
      });
      let counter = 0;
      AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => {
        params.Key.name.should.equal(name);
        params.Key.version.should.equal(`${counter}`);
        counter += 1;
        cb(undefined, 'Success');
      });

      const credstash = defCredstash();
      return credstash.deleteSecrets({
        name,
      })
        .then(res => res.forEach(next => next.should.equal('Success')));
    });
  });

  describe('#deleteSecret', () => {
    const name = 'name';
    const version = 'version';
    const numVer = 42;

    it('should reject empty options', () => {
      AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => cb(new Error('Error')));

      const credstash = defCredstash();
      return credstash.deleteSecret()
        .then(res => expect(res).to.not.exist)
        .catch(err => err.message.should.equal('name is a required parameter'));
    });

    it('should reject a missing name', () => {
      AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => cb(new Error('Error')));

      const credstash = defCredstash();
      return credstash.deleteSecret({ version })
        .then(res => expect(res).to.not.exist)
        .catch(err => err.message.should.equal('name is a required parameter'));
    });

    it('should reject missing version', () => {
      AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => cb(new Error('Error')));

      const credstash = defCredstash();
      return credstash.deleteSecret({ name })
        .then(res => expect(res).to.not.exist)
        .catch(err => err.message.should.equal('version is a required parameter'));
    });


    it('should delete the correct item', () => {
      AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => {
        params.Key.name.should.equal(name);
        params.Key.version.should.equal(version);
        cb(undefined, 'Success');
      });

      const credstash = defCredstash();
      return credstash.deleteSecret({ name, version })
        .then(res => res.should.equal('Success'));
    });

    it('should convert numerical versions into strings', () => {
      AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => {
        params.Key.name.should.equal(name);
        params.Key.version.should.equal(`00000000000000000${numVer}`);
        cb(undefined, 'Success');
      });

      const credstash = defCredstash();
      return credstash.deleteSecret({ name, version: numVer })
        .then(res => res.should.equal('Success'));
    });
  });

  describe('#listSecrets', () => {
    it('should return all secret names and versions', () => {
      const items = [{ name: 'name', version: 'version1' }, { name: 'name', version: 'version2' }];
      AWS.mock('DynamoDB.DocumentClient', 'scan', (params, cb) => cb(undefined, { Items: items }));
      const credstash = defCredstash();
      return credstash.listSecrets()
        .then((results) => {
          results.length.should.equal(2);
          results[0].name.should.equal('name');
          results[0].version.should.equal('version2');
          results[1].name.should.equal('name');
          results[1].version.should.equal('version1');
        });
    });
  });

  describe('#getAllSecrets', () => {
    let items;
    let kms;

    const item1 = encryption.item;
    const item2 = encryption.credstashKey;

    function addItem(item) {
      items[item.name] = items[item.name] || {};
      items[item.name][item.version] = {
        contents: item.contents,
        key: item.key,
        hmac: item.hmac || item.hmacSha256,
        name: item.name,
        version: item.version,
      };
      kms[item.key] = item.kms;
    }

    beforeEach(() => {
      items = {};
      kms = {};

      addItem(item1);
      addItem(item2);

      AWS.mock('DynamoDB.DocumentClient', 'scan', (params, cb) => {
        const Items = [];
        Object.keys(items).forEach((name) => {
          const next = items[name];
          Object.keys(next).forEach(version => Items.push(next[version]));
        });
        cb(undefined, { Items });
      });

      AWS.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
        const Item = items[params.Key.name][params.Key.version];
        cb(undefined, { Item });
      });

      AWS.mock('KMS', 'decrypt', (params, cb) => {
        cb(undefined, kms[params.CiphertextBlob.toString('base64')]);
      });
    });

    it('should return all secrets', () => {
      const credstash = defCredstash();
      return credstash.getAllSecrets()
        .then((res) => {
          Object.keys(res).length.should.equal(2);
          const unsorted = Object.keys(res);
          const sorted = Object.keys(res).sort();
          unsorted.should.deep.equal(sorted);
        });
    });

    it('should ignore bad secrets', () => {
      const item3 = Object.assign({}, item1);
      item3.contents += 'hello broken';
      item3.name = 'differentName';
      addItem(item3);
      const credstash = defCredstash();
      return credstash.getAllSecrets()
        .then((res) => {
          Object.keys(res).length.should.equal(2);
          const unsorted = Object.keys(res);
          const sorted = Object.keys(res).sort();
          unsorted.should.deep.equal(sorted);
        });
    });

    it('should return all secrets, but only latest version', () => {
      const item3 = Object.assign({}, item1);
      item3.version = item3.version.replace('1', '2');
      item3.plainText = 'This is a new plaintext';
      const encrypted = encrypter.encrypt(undefined, item3.plainText, item3.kms);
      item3.contents = encrypted.contents;
      item3.hmac = encrypted.hmac;

      addItem(item3);

      const credstash = defCredstash();
      return credstash.getAllSecrets()
        .then((res) => {
          Object.keys(res).length.should.equal(2);
          res[item3.name].should.equal(item3.plainText);
        });
    });
  });

  describe('#createDdbTable', () => {
    it('should call createTable with the table name provided', () => {
      const table = 'TableNameNonDefault';
      AWS.mock('DynamoDB', 'describeTable', (params, cb) => {
        params.TableName.should.equal(table);
        cb();
      });
      const credstash = defCredstash({ table });
      return credstash.createDdbTable()
        .catch(err => expect(err).to.not.exist);
    });
  });
});
