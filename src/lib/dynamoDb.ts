import {
  DynamoDBClient,
  DescribeTableCommand,
  CreateTableCommand,
  waitUntilTableExists,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  QueryCommandInput,
  QueryCommandOutput,
  ScanCommandOutput,
} from '@aws-sdk/lib-dynamodb';

import debugFn from 'debug';

import { pause } from './utils';
import {
  NameAndVersionOpts,
  NameOpts,
  Opts,
  QueryOpts,
  SecretRecord,
} from '../types';
import { DEFAULT_TABLE } from '../defaults';

const debug = debugFn('credStash');

const createTableQuery = (TableName: string) => new CreateTableCommand({
  TableName,
  KeySchema: [
    {
      AttributeName: 'name',
      KeyType: 'HASH',
    },
    {
      AttributeName: 'version',
      KeyType: 'RANGE',
    },
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'name',
      AttributeType: 'S',
    },
    {
      AttributeName: 'version',
      AttributeType: 'S',
    },
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1,
  },
});

const combineResults = <T extends QueryCommandOutput | ScanCommandOutput>(
  curr: T,
  next: T,
): T => {
  if (!curr) {
    return next;
  }

  return Object.assign({}, next, {
    Items: curr.Items.concat(next.Items),
    Count: curr.Count + next.Count,
  });
};

type CreateAllVersionsQuery = NameOpts & QueryOpts;

const createAllVersionsQuery = (
  { limit, name, tableName = DEFAULT_TABLE }: CreateAllVersionsQuery,
) => {
  const params: QueryCommandInput = {
    TableName: tableName,
    ConsistentRead: true,
    ScanIndexForward: false,
    KeyConditionExpression: '#name = :name',
    ExpressionAttributeNames: {
      '#name': 'name',
    },
    Limit: limit,
    ExpressionAttributeValues: {
      ':name': name,
    },
  };
  return params;
};

export class DynamoDB {
  readonly #docClient: DynamoDBDocumentClient;

  readonly #ddb: DynamoDBClient;

  constructor(
    ddb: DynamoDBClient,
  ) {
    this.#ddb = ddb;
    this.#docClient = DynamoDBDocumentClient.from(this.#ddb);
  }

  async getAllVersions(opts: QueryOpts & NameOpts) {
    let LastEvaluatedKey;
    let curr: QueryCommandOutput;
    do {
      const params = createAllVersionsQuery(opts);
      const next = await this.#docClient.send(new QueryCommand({
        ...params,
        ExclusiveStartKey: LastEvaluatedKey,
      }));
      curr = combineResults(curr, next);
      ({ LastEvaluatedKey } = next);
    } while (LastEvaluatedKey);

    return curr as unknown as { Items: SecretRecord[] };
  }

  async getAllSecretsAndVersions({ limit, tableName = DEFAULT_TABLE }: QueryOpts = {}) {
    let LastEvaluatedKey;
    let curr;
    do {
      const cmd = new ScanCommand({
        TableName: tableName,
        Limit: limit,
        ProjectionExpression: '#name, #version',
        ExclusiveStartKey: LastEvaluatedKey,
        ExpressionAttributeNames: {
          '#name': 'name',
          '#version': 'version',
        },
      });
      const next = await this.#docClient.send(cmd);
      curr = combineResults(curr, next);
      ({ LastEvaluatedKey } = next);
    } while (LastEvaluatedKey);

    return curr as unknown as { Items: SecretRecord[] };
  }

  getLatestVersion(opts: NameOpts) {
    const params = createAllVersionsQuery({ ...opts, limit: 1 });
    return this.#docClient.send(new QueryCommand(params)) as unknown as Promise<{
      Items: SecretRecord[];
    }>;
  }

  getByVersion({ name, version, tableName = DEFAULT_TABLE }: NameAndVersionOpts) {
    const params = {
      TableName: tableName,
      Key: { name, version },
    };
    return this.#docClient.send(new GetCommand(params)) as unknown as Promise<{
      Item: SecretRecord;
    }>;
  }

  async createSecret(
    item: SecretRecord,
    tableName = DEFAULT_TABLE,
  ) {
    const params = {
      Item: item,
      ConditionExpression: 'attribute_not_exists(#name)', // Never update an existing key
      TableName: tableName,

      ExpressionAttributeNames: {
        '#name': 'name',
      },
    };
    const result = await this.#docClient.send(new PutCommand(params));
    return result;
  }

  deleteSecret({ tableName = DEFAULT_TABLE, name, version }: NameAndVersionOpts) {
    const params = {
      TableName: tableName,
      Key: { name, version },
    };
    return this.#docClient.send(new DeleteCommand(params));
  }

  async createTable({ tableName: TableName = DEFAULT_TABLE }: Opts = {}) {
    try {
      await this.#ddb.send(new DescribeTableCommand({ TableName }));
      debug('Credential Store table already exists');
    } catch (err) {
      if (!(err instanceof ResourceNotFoundException)) {
        throw err;
      }
      debug('Creating table...');
      await this.#ddb.send(createTableQuery(TableName));
      debug('Waiting for table to be created...');
      await pause(2e3);
      await waitUntilTableExists(
        {
          client: this.#ddb,
          maxWaitTime: 900,
        },
        { TableName },
      );
      debug('Table has been created');
      debug('Please go to the README to learn how to create your KMS key');
    }
  }
}
