'use strict';

const debug = require('debug')('credstash');

const DynamoDB = require('./lib/dynamoDb');
const KMS = require('./lib/kms');


const encrypter = require('./lib/encrypter');
const decrypter = require('./lib/decrypter');
const defaults = require('./defaults');
const utils = require('./lib/utils');


module.exports = function (configuration) {
  const config = Object.assign({}, configuration);

  const awsOpts = Object.assign({}, config.awsOpts);

  const table = config.table || defaults.DEFAULT_TABLE;
  const kmsKey = config.kmsKey || defaults.DEFAULT_KMS_KEY;

  const ddb = new DynamoDB(table, awsOpts);
  const kms = new KMS(kmsKey, awsOpts);


  class Credstash {

    constructor() {
      const credstash = this;
      Object.getOwnPropertyNames(Credstash.prototype).forEach((key) => {
        const method = credstash[key];
        credstash[key] = function () {
          const args = Array.from(arguments);
          const lastArg = args.slice(-1)[0];
          let cb;
          if (typeof lastArg === 'function') {
            cb = args.pop();
          }
          return method.apply(credstash, args)
            .then((res) => {
              if (cb) {
                return cb(undefined, res);
              }
              return res;
            })
            .catch((err) => {
              if (cb) {
                return cb(err);
              }
              throw err;
            });
        };
      });

      this.paddedInt = utils.paddedInt;
    }

    /**
     * Retrieve the highest version of `name` in the table
     *
     * @param opts
     * @returns {Promise.<number>}
     */

    getHighestVersion(opts) {
      const options = Object.assign({}, opts);
      const name = options.name;
      if (!name) {
        return Promise.reject(new Error('name is a required parameter'));
      }

      return ddb.getLatestVersion(name)
        .then((res) => {
          let version = 0;
          if (res) {
            version = res.version;
          }
          return version;
        });
    }

    incrementVersion(opts) {
      return this.getHighestVersion(opts)
        .then((version) => {
          if (Number.parseInt(version, 10) == version) {
            return Number.parseInt(version, 10);
          }
          throw new Error(`Can not autoincrement version. The current version: ${version} is not an int`);
        })
        .then(version => utils.paddedInt(defaults.PAD_LEN, version + 1));
    }

    putSecret(opts) {
      const options = Object.assign({}, opts);
      const name = options.name;
      if (!name) {
        return Promise.reject(new Error('name is a required parameter'));
      }

      const secret = options.secret;
      if (!secret) {
        return Promise.reject(new Error('secret is a required parameter'));
      }

      const version = utils.sanitizeVersion(options.version, 1); // optional
      const context = options.context; // optional
      const digest = options.digest || defaults.DEFAULT_DIGEST; // optional

      return kms.getEncryptionKey(context)
        .catch((err) => {
          if (err.code == 'NotFoundException') {
            throw err;
          }
          throw new Error(`Could not generate key using KMS key ${kmsKey}`);
        })
        .then(kmsData => encrypter.encrypt(digest, secret, kmsData))
        .then(data => Object.assign({ name, version }, data))
        .then(data => ddb.createSecret(data))
        .catch((err) => {
          if (err.code == 'ConditionalCheckFailedException') {
            throw new Error(`${name} version ${version} is already in the credential store.`);
          } else {
            throw err;
          }
        });
    }

    getSecret(opts) {
      const options = Object.assign({}, opts);
      const name = options.name;
      if (!name) {
        return Promise.reject(new Error('name is a required parameter'));
      }
      const version = utils.sanitizeVersion(options.version); // optional
      const context = options.context; // optional

      const func = version == undefined ?
        ddb.getLatestVersion(name) : ddb.getByVersion(name, version);

      return func
        .then((stash) => {
          if (!stash || !stash.key) {
            throw new Error(`Item {'name': '${name}'} could not be found.`);
          }
          return Promise.all([
            stash,
            kms.decrypt(utils.b64decode(stash.key), context)
              .catch((err) => {
                let msg = `Decryption error: ${JSON.stringify(err, null, 2)}`;

                if (err.code == 'InvalidCiphertextException') {
                  if (context) {
                    msg = 'Could not decrypt hmac key with KMS. The encryption ' +
                      'context provided may not match the one used when the ' +
                      'credential was stored.';
                  } else {
                    msg = 'Could not decrypt hmac key with KMS. The credential may ' +
                      'require that an encryption context be provided to decrypt ' +
                      'it.';
                  }
                }
                throw new Error(msg);
              }),
          ]);
        })
        .then(res => decrypter.decrypt(res[0], res[1]));
    }

    deleteSecrets(opts) {
      const options = Object.assign({}, opts);
      const name = options.name;
      if (!name) {
        return Promise.reject(new Error('name is a required parameter'));
      }

      return ddb.getAllVersions(name)
        .then(res => res.Items)
        .then(secrets => utils.mapPromise(secrets,
          secret => this.deleteSecret({ name: secret.name, version: secret.version }))
        );
    }

    deleteSecret(opts) {
      const options = Object.assign({}, opts);
      const name = options.name;
      if (!name) {
        return Promise.reject(new Error('name is a required parameter'));
      }
      const version = utils.sanitizeVersion(options.version);
      if (!version) {
        return Promise.reject(new Error('version is a required parameter'));
      }
      debug(`Deleting ${name} -- version ${version}`);
      return ddb.deleteSecret(name, version);
    }

    listSecrets() {
      return ddb.getAllSecretsAndVersions()
        .then(res => res.Items.sort(utils.sortSecrets));
    }

    getAllSecrets(opts) {
      const options = Object.assign({}, opts);
      const version = options.version;
      const context = options.context;

      const unOrdered = {};
      return this.listSecrets()
        .then((secrets) => {
          const position = {};
          const filtered = [];
          secrets
            .filter(secret => secret.version == (version || secret.version))
            .forEach((next) => {
              position[next.name] = position[next.name] ? position[next.name] : filtered.push(next);
            });

          return filtered;
        })
        .then(secrets =>
          utils.mapPromise(secrets, secret =>
            this.getSecret({ name: secret.name, version: secret.version, context })
              .then((plainText) => {
                unOrdered[secret.name] = plainText;
              })
              .catch(() => undefined)
          )
        )
        .then(() => {
          const ordered = {};
          Object.keys(unOrdered).sort().forEach((key) => {
            ordered[key] = unOrdered[key];
          });
          return ordered;
        });
    }

    createDdbTable() {
      return ddb.createTable();
    }

  }
  return new Credstash();
};
