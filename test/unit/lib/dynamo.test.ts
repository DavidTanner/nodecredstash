import { ulid } from 'ulid';

import {
  DescribeTableCommand,
  CreateTableCommand,
  ResourceNotFoundException,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';

import {
  QueryCommand,
  ScanCommand,
  PutCommand,
  DeleteCommand, GetCommand, QueryCommandInput, ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';

import { DynamoDB } from '../../../src/lib/dynamoDb';
import { mockDocClient, mockDdb } from '../utils/awsSdk';
import { SecretRecord } from '../../../src/types';
import { DEFAULT_TABLE } from '../../../src/defaults';

let items: SecretRecord[];
const ddb = new DynamoDBClient({});
const dynamo = new DynamoDB(ddb);

const findKeyIndex = (
  records: SecretRecord[],
  keys: ScanCommandInput['ExclusiveStartKey'] | QueryCommandInput['ExclusiveStartKey'],
) => {
  const index = records.findIndex((item) => {
    let matches = true;
    Object.entries(keys).forEach(([key, value]) => {
      matches = matches && item[key] === value;
    });
    return matches;
  });
  return index;
};

const sliceItems = (
  records: SecretRecord[],
  params: QueryCommandInput | ScanCommandInput,
) => {
  const limit = params.Limit || records.length;
  let startIndex = 0;

  if (params.ExclusiveStartKey) {
    startIndex = findKeyIndex(records, params.ExclusiveStartKey) + 1;
  }

  const Items = records.slice(startIndex, startIndex + limit);

  const lastIndex = (startIndex + limit) - 1;
  let LastEvaluatedKey;

  const last = records[lastIndex];
  if (lastIndex < (records.length - 1) && last) {
    LastEvaluatedKey = { name: last.name, version: last.version };
  }

  const Count = Items.length;
  const ScannedCount = Count;

  const results = {
    LastEvaluatedKey,
    Items,
    ScannedCount,
    Count,
  };
  return results;
};

const compareParams = (
  actual: QueryCommandInput & ScanCommandInput,
  expected: QueryCommandInput & ScanCommandInput,
) => {
  if (expected.TableName) {
    expect(actual.TableName).toEqual(expected.TableName);
  }
  if (expected.ExpressionAttributeNames) {
    expect(actual.ExpressionAttributeNames).toEqual(expected.ExpressionAttributeNames);
  }
  if (expected.KeyConditionExpression) {
    expect(actual.KeyConditionExpression).toEqual(expected.KeyConditionExpression);
  }

  if (expected.ProjectionExpression) {
    expect(actual.ProjectionExpression).toEqual(expected.ProjectionExpression);
  }

  if (expected.Limit) {
    expect(actual.Limit).toBeDefined();
    expect(actual.Limit).toEqual(expected.Limit);
  }

  if (expected.ExpressionAttributeValues) {
    expect(actual.ExpressionAttributeValues).toEqual(expected.ExpressionAttributeValues);
  }
};

const mockQueryScan = (
  records: SecretRecord[],
  expectedParams: QueryCommandInput | ScanCommandInput,
  error?: Error,
) => {
  const fn = (params: QueryCommandInput | ScanCommandInput) => {
    compareParams(params, expectedParams);
    const results = sliceItems(records, params);
    if (error) {
      throw error;
    }
    return results;
  };

  mockDocClient.on(QueryCommand).callsFake(fn);
  mockDocClient.on(ScanCommand).callsFake(fn);
};

beforeEach(() => {
  items = Array.from<unknown, SecretRecord>({ length: 30 }, (v, i) => ({
    name: `${i}`,
    version: `${i}`,
    key: ulid(),
    contents: ulid(),
    hmac: ulid(),
  }));
});

describe('#getAllSecretsAndVersions', () => {
  test.each([
    undefined,
    { limit: 10 },
    { tableName: ulid() },
  ])('%# should properly page through many results', async (opts) => {
    const TableName = opts?.tableName ?? DEFAULT_TABLE;
    mockQueryScan(items, {
      Limit: opts?.limit,
      TableName,
    });

    await expect(dynamo.getAllSecretsAndVersions(opts))
      .resolves.toEqual({
        Items: items,
        Count: items.length,
        LastEvaluatedKey: undefined,
        ScannedCount: opts?.limit ?? items.length,
      });
  });
});

describe.each([undefined, ulid()])('with provided tableName %s', (tableName) => {
  const TableName = tableName ?? DEFAULT_TABLE;
  describe('#getAllVersions', () => {
    test('should properly page through many results', () => {
      mockQueryScan(items, {
        Limit: 10,
        TableName,
      });

      return dynamo.getAllVersions({ tableName, name: '', limit: 10 })
        .then((res) => res.Items)
        .then((secrets) => {
          expect(secrets).toHaveLength(items.length);
          expect(secrets).toEqual(items);
        });
    });
  });

  describe('#getLatestVersion', () => {
    test('should only get one item back', async () => {
      mockQueryScan(items, {
        Limit: 1,
        TableName,
      });

      const res = await dynamo.getLatestVersion({ tableName, name: '' });
      expect(res).toBeDefined();
      expect(res.Items).toBeDefined();
      expect(res.Items[0]).toBeDefined();
      expect(res.Items[0]).toBe(items[0]);
    });
  });

  describe('#getByVersion', () => {
    test('should only get one item back', async () => {
      const name = 'name';
      const version = 'version';
      mockDocClient.on(GetCommand).callsFake((params) => {
        expect(params).toHaveProperty('TableName', TableName);
        expect(params.Key).toBeDefined();
        expect(params.Key).toHaveProperty(name, name);
        expect(params.Key).toHaveProperty(version, version);
        return { Item: 'Success' };
      });

      const res = await dynamo.getByVersion({ tableName, name, version });
      expect(res).toBeDefined();
      expect(res.Item).toBe('Success');
    });
  });

  describe('#createSecret', () => {
    test('should create an item in DynamoDB', async () => {
      const item = items[0];
      mockDocClient.on(PutCommand).callsFake((params) => {
        expect(params.TableName).toBe(TableName);
        expect(params.ConditionExpression).toBeDefined();
        expect(params.ConditionExpression).toBe('attribute_not_exists(#name)');
        expect(params.ExpressionAttributeNames).toBeDefined();
        expect(params.ExpressionAttributeNames).toEqual({
          '#name': 'name',
        });
        expect(params.Item).toEqual(item);
        return Promise.resolve('Success');
      });
      await expect(dynamo.createSecret(item, tableName)).resolves.toBe('Success');
    });
  });

  describe('#deleteSecret', () => {
    test('should delete the secret by name and version', async () => {
      const name = 'name';
      const version = 'version';
      mockDocClient.on(DeleteCommand).callsFake((params) => {
        expect(params.TableName).toBe(TableName);
        expect(params.Key).toBeDefined();
        expect(params.Key).toHaveProperty(name, name);
        expect(params.Key).toHaveProperty(version, version);
        return Promise.resolve('Success');
      });

      await expect(dynamo.deleteSecret({ tableName, name, version })).resolves.toBe('Success');
    });
  });
});

describe('#createTable', () => {
  test('should create the table with the HASH as name and RANGE as version', async () => {
    mockDdb.on(DescribeTableCommand)
      .rejectsOnce(
        // @ts-expect-error
        new ResourceNotFoundException({}),
      )
      .resolves({
        Table: { TableStatus: 'ACTIVE' },
      });
    mockDdb.on(CreateTableCommand).callsFake((params) => {
      expect(params.TableName).toBe(DEFAULT_TABLE);
      expect(params.KeySchema).toBeDefined();
      expect(params.KeySchema.find).toBeDefined();
      expect(params.KeySchema).toHaveLength(2);

      const hash = params.KeySchema.find(({ KeyType }) => KeyType === 'HASH');
      expect(hash).toBeDefined();
      expect(hash).toEqual({
        AttributeName: 'name',
        KeyType: 'HASH',
      });
      const range = params.KeySchema.find((next) => next.KeyType === 'RANGE');
      expect(range).toBeDefined();
      expect(range).toEqual({
        AttributeName: 'version',
        KeyType: 'RANGE',
      });
      expect(params.AttributeDefinitions).toBeDefined();
      expect(params.AttributeDefinitions.find).toBeDefined();
      expect(params.AttributeDefinitions).toHaveLength(2);
      const name = params.AttributeDefinitions.find((next) => next.AttributeName === 'name');
      expect(name).toBeDefined();
      expect(name).toEqual({
        AttributeName: 'name',
        AttributeType: 'S',
      });
      const version = params.AttributeDefinitions.find((next) => next.AttributeName === 'version');
      expect(version).toBeDefined();
      expect(version).toEqual({
        AttributeName: 'version',
        AttributeType: 'S',
      });
      expect(params.ProvisionedThroughput).toBeDefined();
      expect(params.ProvisionedThroughput).toEqual({
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      });
    });

    await expect(dynamo.createTable()).resolves.not.toThrow();
    expect(mockDdb.commandCalls(CreateTableCommand)).toHaveLength(1);
  }, 5e3);

  test('should not create a table if one exists', async () => {
    const tableName = ulid();
    mockDdb.on(DescribeTableCommand).resolves({});
    await expect(dynamo.createTable()).resolves.not.toThrow();
    await expect(dynamo.createTable({})).resolves.not.toThrow();
    await expect(dynamo.createTable({ tableName })).resolves.not.toThrow();
    expect(mockDdb.commandCalls(CreateTableCommand)).toHaveLength(0);
    expect(mockDdb.commandCalls(DescribeTableCommand)).toHaveLength(3);
    expect(mockDdb.commandCalls(
      DescribeTableCommand,
      { TableName: DEFAULT_TABLE },
    )).toHaveLength(2);
    expect(mockDdb.commandCalls(DescribeTableCommand, { TableName: tableName })).toHaveLength(1);
  });

  test('should throw any exception that is not ResourceNotFoundException', async () => {
    mockDdb.on(DescribeTableCommand).rejects(new Error('Error'));
    await expect(dynamo.createTable()).rejects.toThrow('Error');
    expect(mockDdb.commandCalls(CreateTableCommand)).toHaveLength(0);
  });
});
