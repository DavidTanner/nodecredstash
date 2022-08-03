import { KMSClient } from '@aws-sdk/client-kms';
import {
  ConditionalCheckFailedException,
  DeleteItemCommandOutput,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { PutCommandOutput } from '@aws-sdk/lib-dynamodb';
import debugFn from 'debug';

import { DynamoDB } from './lib/dynamoDb';
import { paddedInt, sanitizeVersion, sortSecrets } from './lib/utils';
import { KeyService } from './lib/keyService';
import { sealAesCtrLegacy, openAesCtrLegacy } from './lib/aesCredstash';
import {
  Configuration,
  GetAllSecrets,
  GetAllVersions,
  GetHighestVersionResponse,
  GetSecret,
  NameAndVersionOpts,
  NameOpts, Opts,
  PutSecret,
  QueryOpts,
  SecretRecord,
} from './types';

const debug = debugFn('credStash');

export class CredStash {
  readonly #kmsClient: KMSClient;

  readonly #ddb: DynamoDB;

  readonly paddedInt = paddedInt;

  constructor(
    {
      kmsOpts = {},
      dynamoOpts = {},
    }: Configuration = {},
  ) {
    this.#kmsClient = new KMSClient(kmsOpts);
    this.#ddb = new DynamoDB(new DynamoDBClient(dynamoOpts));
    const credStash = this;
    Object.getOwnPropertyNames(CredStash.prototype).forEach((key) => {
      const method = credStash[key];
      credStash[key] = (...args) => {
        const lastArg = args.slice(-1)[0];
        let cb;
        if (typeof lastArg === 'function') {
          cb = args.pop();
        }
        return method.apply(credStash, args)
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
  }

  /**
   * Retrieve the highest version of `name` in the table
   */
  getHighestVersion(opts: NameOpts): Promise<string>;

  getHighestVersion(opts: NameOpts, cb: (e: any | Error, version: string) => void): void;

  async getHighestVersion(opts: NameOpts): Promise<string> {
    const { Items = [] } = await this.#ddb.getLatestVersion(opts);
    const [{ version = paddedInt(0) } = {}] = Items;
    return version;
  }

  incrementVersion(opts: NameOpts): Promise<string>;

  incrementVersion(opts: NameOpts, cb: (e: any | Error, version: string) => void): void;

  async incrementVersion(opts: NameOpts) {
    const rawVersion = await this.getHighestVersion(opts);
    if (`${rawVersion}`.match(/^[0-9]+$/)) {
      const version = Number.parseInt(rawVersion, 10) + 1;
      return paddedInt(version);
    }
    throw new Error(`Can not autoincrement version. The current version: ${rawVersion} is not an int`);
  }

  putSecret(opts: PutSecret): Promise<PutCommandOutput>;

  putSecret(opts: PutSecret, cb: (e: any | Error) => PutCommandOutput): void;

  async putSecret(
    {
      name,
      version: origVersion,
      secret,
      context,
      digest,
      kmsKey,
      tableName,
    }: PutSecret,
  ) {
    const version = sanitizeVersion(origVersion, 1);
    const keyService = new KeyService(new KMSClient({}), kmsKey, context);
    const sealed = await sealAesCtrLegacy(keyService, secret, digest);
    const data: SecretRecord = Object.assign({ name, version }, sealed);
    try {
      const result = await this.#ddb.createSecret(data, tableName);
      return result;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        throw new Error(`${name} version ${version} is already in the credential store.`);
      }
      throw err;
    }
  }

  getAllVersions(opts: GetAllVersions): Promise<GetHighestVersionResponse[]>;

  getAllVersions(opts: GetAllVersions, cb: (e: any | Error, data: GetHighestVersionResponse[]) => void): void;

  async getAllVersions(
    {
      name,
      context,
      limit,
      kmsKey,
      tableName,
    }: GetAllVersions,
  ): Promise<GetHighestVersionResponse[]> {
    const keyService = new KeyService(this.#kmsClient, kmsKey, context);

    const { Items = [] } = await this.#ddb.getAllVersions({ name, tableName, limit });
    return Promise.all(Items.map(async (record) => ({
      version: record.version,
      secret: await openAesCtrLegacy(keyService, record),
    })));
  }

  getSecret(opts: GetSecret, cb: (e: any | Error, data: string) => void): void;

  getSecret(opts: GetSecret): Promise<string>;

  async getSecret(
    {
      name,
      context,
      version: origVersion,
      kmsKey,
      tableName,
    }: GetSecret,
  ) {
    const version = sanitizeVersion(origVersion);
    const keyService = new KeyService(new KMSClient({}), kmsKey, context);

    let record: SecretRecord;
    if (version) {
      ({ Item: record } = await this.#ddb.getByVersion({ name, version, tableName }));
    } else {
      ({ Items: [record] } = await this.#ddb.getLatestVersion({ name, tableName }));
    }

    if (!record || !record.key) {
      throw new Error(`Item {'name': '${name}'} could not be found.`);
    }

    const decrypted = await openAesCtrLegacy(keyService, record);
    return decrypted;
  }

  deleteSecrets(opts: NameOpts): Promise<DeleteItemCommandOutput[]>;

  deleteSecrets(opts: NameOpts, cb: (e: any | Error, data: DeleteItemCommandOutput[]) => void): void;

  async deleteSecrets(opts: NameOpts) {
    const { Items = [] } = await this.#ddb.getAllVersions(opts);

    const results = [];
    for (const secret of Items) {
      const result = await this.deleteSecret(
        { name: opts.name, version: secret.version },
      );
      results.push(result);
    }
    return results;
  }

  deleteSecret(opts: NameAndVersionOpts): Promise<DeleteItemCommandOutput>;

  deleteSecret(opts: NameAndVersionOpts, cb: (e: any | Error, data: DeleteItemCommandOutput) => void): void;

  async deleteSecret(
    {
      version: origVersion,
      name,
      ...opts
    }: NameAndVersionOpts,
  ) {
    const version = sanitizeVersion(origVersion);
    if (!version) {
      throw new Error('version is a required parameter');
    }
    debug(`Deleting ${name} -- version ${version}`);
    return this.#ddb.deleteSecret({ ...opts, name, version });
  }

  listSecrets(opts?: QueryOpts): Promise<{ name: string; version: string }[]>;

  listSecrets(opts: QueryOpts, cb: (e: any | Error, data: { name: string; version: string }[]) => void): void;

  // @ts-expect-error opts is optional in the signature
  listSecrets(cb: (e: any | Error, data: { name: string; version: string }[]) => void): void;

  async listSecrets(opts?: QueryOpts) {
    const { Items = [] } = await this.#ddb.getAllSecretsAndVersions(opts);
    return Items.sort(sortSecrets);
  }

  getAllSecrets(opts?: GetAllSecrets): Promise<Record<string, string>>;

  getAllSecrets(opts: GetAllSecrets, cb: (e: any | Error, data: Record<string, string>) => void): void;

  // @ts-expect-error opts is optional in the signature
  getAllSecrets(cb: (e: any | Error, data: Record<string, string>) => void): void;

  async getAllSecrets(
    {
      version,
      startsWith,
      ...opts
    }: GetAllSecrets = {},
  ) {
    const unOrdered = {};
    const secrets = await this.listSecrets(opts);

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
          ...opts,
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

  createDdbTable(opts: Opts, cb: (e: any | Error, data: void) => void): void;

  // @ts-expect-error opts is optional in the signature
  createDdbTable(cb: (e: any | Error, data: void) => void): void;

  createDdbTable(opts?: Opts): Promise<void>;

  createDdbTable(opts?: Opts) {
    return this.#ddb.createTable(opts);
  }
}
