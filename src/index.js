const { NotFoundException, InvalidCiphertextException, KMSClient } = require('@aws-sdk/client-kms');
const { ConditionalCheckFailedException } = require('@aws-sdk/client-dynamodb');
const debug = require('debug')('credstash');

const DynamoDB = require('./lib/dynamoDb');
const KMS = require('./lib/kms');

const decrypter = require('./lib/decrypter');
const defaults = require('./defaults');
const utils = require('./lib/utils');
const { KeyService } = require('./lib/keyService');
const { sealAesCtrLegacy } = require('./lib/aesCredstash');

module.exports = function (mainConfig) {
  const config = Object.assign({}, mainConfig);

  const table = config.table || defaults.DEFAULT_TABLE;
  const ddbOpts = Object.assign({}, config.awsOpts, config.dynamoOpts);
  const ddb = new DynamoDB(table, ddbOpts);

  const kmsKey = config.kmsKey || defaults.DEFAULT_KMS_KEY;
  const kmsOpts = Object.assign({}, config.awsOpts, config.kmsOpts);
  const kms = new KMS(kmsKey, kmsOpts);

  class Credstash {
    constructor() {
      const credstash = this;
      Object.getOwnPropertyNames(Credstash.prototype).forEach((key) => {
        const method = credstash[key];
        credstash[key] = (...args) => {
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

      this.getConfiguration = () => {
        const ddbOptsCopy = Object.assign({}, ddbOpts);
        const kmsOptsCopy = Object.assign({}, kmsOpts);
        const configCopy = Object.assign({}, config);

        const configuration = {
          config: configCopy,
          dynamoConfig: {
            table,
            opts: ddbOptsCopy,
          },
          kmsConfig: {
            kmsKey,
            opts: kmsOptsCopy,
          },
        };
        return configuration;
      };
    }

    /**
     * Retrieve the highest version of `name` in the table
     *
     * @param opts
     * @returns {Promise.<number>}
     */

    getHighestVersion(
      {
        name,
      } = {},
    ) {
      if (!name) {
        return Promise.reject(new Error('name is a required parameter'));
      }

      return ddb.getLatestVersion(name)
        .then((res) => res.Items[0])
        .then((res) => {
          const { version = 0 } = res || {};
          return version;
        });
    }

    incrementVersion(opts) {
      return this.getHighestVersion(opts)
        .then((version) => {
          if (`${version}`.match(/^[0-9]+$/)) {
            return Number.parseInt(version, 10);
          }
          throw new Error(`Can not autoincrement version. The current version: ${version} is not an int`);
        })
        .then((version) => utils.paddedInt(defaults.PAD_LEN, version + 1));
    }

    putSecret(
      {
        name,
        version: origVersion,
        secret,
        context,
        digest = defaults.DEFAULT_DIGEST,
      } = {},
    ) {
      if (!name) {
        return Promise.reject(new Error('name is a required parameter'));
      }

      if (!secret) {
        return Promise.reject(new Error('secret is a required parameter'));
      }

      const version = utils.sanitizeVersion(origVersion, 1); // optional
      const keyService = new KeyService(new KMSClient({}), kmsKey, context);
      return sealAesCtrLegacy(keyService, secret, digest)
        .catch((err) => {
          if (err instanceof NotFoundException) {
            throw err;
          }
          throw new Error(`Could not generate key using KMS key ${kmsKey}, error:${JSON.stringify(err, null, 2)}`);
        })
        .then((sealed) => Object.assign({ name, version }, sealed))
        .then((data) => ddb.createSecret(data))
        .catch((err) => {
          if (err instanceof ConditionalCheckFailedException) {
            throw new Error(`${name} version ${version} is already in the credential store.`);
          } else {
            throw err;
          }
        });
    }

    decryptStash(stash, context) {
      const key = utils.b64decode(stash.key);
      return kms.decrypt(key, context)
        .catch((err) => {
          let msg = `Decryption error: ${JSON.stringify(err, null, 2)}`;

          if (err instanceof InvalidCiphertextException) {
            if (context) {
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
        });
    }

    getAllVersions(
      {
        name,
        context, // optional
        limit, // optional
      } = {},
    ) {
      if (!name) {
        return Promise.reject(new Error('name is a required parameter'));
      }

      return ddb.getAllVersions(name, { limit })
        .then((results) => {
          const dataKeyPromises = results.Items.map((stash) => this.decryptStash(stash, context)
            .then((decryptedDataKey) => Object.assign(stash, { decryptedDataKey })));
          return Promise.all(dataKeyPromises);
        }).then((stashes) => stashes.map((stash) => ({
          version: stash.version,
          secret: decrypter.decrypt(stash, stash.decryptedDataKey),
        })));
    }

    getSecret(
      {
        name,
        context,
        version: origVersion,
      } = {},
    ) {
      if (!name) {
        return Promise.reject(new Error('name is a required parameter'));
      }
      const version = utils.sanitizeVersion(origVersion); // optional

      const func = version === undefined
        ? ddb.getLatestVersion(name).then((res) => res.Items[0])
        : ddb.getByVersion(name, version).then((res) => res.Item);

      return func
        .then((stash) => {
          if (!stash || !stash.key) {
            throw new Error(`Item {'name': '${name}'} could not be found.`);
          }
          return Promise.all([
            stash,
            this.decryptStash(stash, context),
          ]);
        })
        .then((res) => decrypter.decrypt(res[0], res[1]));
    }

    deleteSecrets({ name } = {}) {
      if (!name) {
        return Promise.reject(new Error('name is a required parameter'));
      }

      return ddb.getAllVersions(name)
        .then((res) => res.Items)
        .then((secrets) => utils.mapPromise(secrets, (secret) => this.deleteSecret({
          name: secret.name,
          version: secret.version,
        })));
    }

    deleteSecret(
      {
        name,
        version: origVersion,
      } = {},
    ) {
      if (!name) {
        return Promise.reject(new Error('name is a required parameter'));
      }
      const version = utils.sanitizeVersion(origVersion);
      if (!version) {
        return Promise.reject(new Error('version is a required parameter'));
      }
      debug(`Deleting ${name} -- version ${version}`);
      return ddb.deleteSecret(name, version);
    }

    listSecrets() {
      return ddb.getAllSecretsAndVersions()
        .then((res) => res.Items.sort(utils.sortSecrets));
    }

    getAllSecrets(
      {
        version,
        context,
        startsWith,
      } = {},
    ) {
      const unOrdered = {};
      return this.listSecrets()
        .then((secrets) => {
          const position = {};
          const filtered = [];
          secrets
            .filter((secret) => secret.version === (version || secret.version))
            .filter((secret) => !startsWith || secret.name.startsWith(startsWith))
            .forEach((next) => {
              position[next.name] = position[next.name]
                ? position[next.name] : filtered.push(next);
            });

          return filtered;
        })
        .then((secrets) => utils.mapPromise(secrets, async (secret) => {
          try {
            const plainText = await this.getSecret({
              name: secret.name,
              version: secret.version,
              context,
            });
            unOrdered[secret.name] = plainText;
          } catch (e) {
            debug(`Ran into some issue ${JSON.stringify(e)}`);
          }
        }))
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
