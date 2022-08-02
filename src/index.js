const { KMSClient } = require('@aws-sdk/client-kms');
const { ConditionalCheckFailedException } = require('@aws-sdk/client-dynamodb');
const debug = require('debug')('credstash');

const DynamoDB = require('./lib/dynamoDb');

const defaults = require('./defaults');
const utils = require('./lib/utils');
const { KeyService } = require('./lib/keyService');
const { sealAesCtrLegacy, openAesCtrLegacy } = require('./lib/aesCredstash');

module.exports = function (mainConfig) {
  const config = Object.assign({}, mainConfig);

  const table = config.table || defaults.DEFAULT_TABLE;
  const ddbOpts = Object.assign({}, config.awsOpts, config.dynamoOpts);
  const ddb = new DynamoDB(table, ddbOpts);

  const kmsKey = config.kmsKey || defaults.DEFAULT_KMS_KEY;
  const kmsOpts = Object.assign({}, config.awsOpts, config.kmsOpts);

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
    async getHighestVersion(
      {
        name,
      } = {},
    ) {
      if (!name) {
        throw new Error('name is a required parameter');
      }
      const { Items = [] } = await ddb.getLatestVersion(name);
      const [{ version = 0 } = {}] = Items;
      return version;
    }

    async incrementVersion(opts) {
      const rawVersion = await this.getHighestVersion(opts);
      if (`${rawVersion}`.match(/^[0-9]+$/)) {
        const version = Number.parseInt(rawVersion, 10) + 1;
        return utils.paddedInt(version);
      }
      throw new Error(`Can not autoincrement version. The current version: ${rawVersion} is not an int`);
    }

    async putSecret(
      {
        name,
        version: origVersion,
        secret,
        context,
        digest = defaults.DEFAULT_DIGEST,
      } = {},
    ) {
      if (!name) {
        throw new Error('name is a required parameter');
      }

      if (!secret) {
        throw new Error('secret is a required parameter');
      }

      const version = utils.sanitizeVersion(origVersion, 1); // optional
      const keyService = new KeyService(new KMSClient({}), kmsKey, context);
      const data = { name, version };
      const sealed = await sealAesCtrLegacy(keyService, secret, digest);
      Object.assign(data, sealed);
      try {
        return await ddb.createSecret(data);
      } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
          throw new Error(`${name} version ${version} is already in the credential store.`);
        }
        throw err;
      }
    }

    async getAllVersions(
      {
        name,
        context, // optional
        limit, // optional
      } = {},
    ) {
      if (!name) {
        return Promise.reject(new Error('name is a required parameter'));
      }
      const keyService = new KeyService(new KMSClient({}), kmsKey, context);

      const { Items = [] } = await ddb.getAllVersions(name, { limit });
      return Promise.all(Items.map(async (record) => ({
        version: record.version,
        secret: await openAesCtrLegacy(keyService, record),
      })));
    }

    async getSecret(
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
      const keyService = new KeyService(new KMSClient({}), kmsKey, context);

      let record;
      if (version) {
        ({ Item: record } = await ddb.getByVersion(name, version));
      } else {
        ({ Items: [record] } = await ddb.getLatestVersion(name));
      }

      if (!record || !record.key) {
        throw new Error(`Item {'name': '${name}'} could not be found.`);
      }

      const decrypted = await openAesCtrLegacy(keyService, record);
      return decrypted;
    }

    async deleteSecrets({ name } = {}) {
      if (!name) {
        return Promise.reject(new Error('name is a required parameter'));
      }

      const { Items = [] } = await ddb.getAllVersions(name);

      const results = [];
      for (const secret of Items) {
        const result = await this.deleteSecret({ name, version: secret.version });
        results.push(result);
      }
      return results;
    }

    async deleteSecret(
      {
        name,
        version: origVersion,
      } = {},
    ) {
      if (!name) {
        throw new Error('name is a required parameter');
      }
      const version = utils.sanitizeVersion(origVersion);
      if (!version) {
        throw new Error('version is a required parameter');
      }
      debug(`Deleting ${name} -- version ${version}`);
      return ddb.deleteSecret(name, version);
    }

    async listSecrets() {
      const { Items = [] } = await ddb.getAllSecretsAndVersions();
      return Items.sort(utils.sortSecrets);
    }

    async getAllSecrets(
      {
        version,
        context,
        startsWith,
      } = {},
    ) {
      const unOrdered = {};
      const secrets = await this.listSecrets();

      const position = {};
      const ordered = {};
      const filtered = [];
      secrets
        .filter((secret) => secret.version === (version || secret.version))
        .filter((secret) => !startsWith || secret.name.startsWith(startsWith))
        .forEach((next) => {
          position[next.name] = position[next.name]
            ? position[next.name] : filtered.push(next);
        });

      for (const secret of filtered) {
        try {
          unOrdered[secret.name] = await this.getSecret({
            name: secret.name,
            version: secret.version,
            context,
          });
        } catch (e) {
          debug(`Ran into some issue ${JSON.stringify(e)}`);
        }
      }
      Object.keys(unOrdered).sort().forEach((key) => {
        ordered[key] = unOrdered[key];
      });
      return ordered;
    }

    createDdbTable() {
      return ddb.createTable();
    }
  }
  return new Credstash();
};
