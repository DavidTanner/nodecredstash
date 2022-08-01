const _ = require('lodash');

const {
  DescribeTableCommand,
  CreateTableCommand,
  ResourceNotFoundException,
} = require('@aws-sdk/client-dynamodb');

const {
  QueryCommand,
  ScanCommand,
  PutCommand,
  DeleteCommand, GetCommand,
} = require('@aws-sdk/lib-dynamodb');

const DynamoDb = require('../../../src/lib/dynamoDb');
const { mockDocClient, mockDdb } = require('../utils/awsSdk');

const findKeyIndex = (items, keys) => {
  const index = items.findIndex((item) => {
    let matches = true;
    _.forEach(keys, (value, key) => {
      matches = matches && item[key] === value;
    });
    return matches;
  });
  return index;
};

const sliceItems = (items, params) => {
  const limit = params.Limit || items.length;
  let startIndex = 0;

  if (params.ExclusiveStartKey) {
    startIndex = findKeyIndex(items, params.ExclusiveStartKey) + 1;
  }

  const Items = items.slice(startIndex, startIndex + limit);

  const lastIndex = (startIndex + limit) - 1;
  let LastEvaluatedKey;

  const last = items[lastIndex];
  if (lastIndex < (items.length - 1) && last) {
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

const compareParams = (actual, expected) => {
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

const mockQueryScan = (error, items, expectedParams) => {
  const fn = (params) => {
    compareParams(params, expectedParams);
    const results = sliceItems(items, params);
    if (error) {
      throw error;
    }
    return results;
  };

  mockDocClient.on(QueryCommand).callsFake(fn);
  mockDocClient.on(ScanCommand).callsFake(fn);
};

describe('dynmaodDb', () => {
  let dynamo;
  let items;
  const TableName = 'credentials-store';

  beforeEach(() => {
    items = Array.from({ length: 30 }, (v, i) => ({ name: i, version: i }));
  });

  describe('#getAllSecretsAndVersions', () => {
    test('should properly page through many results', () => {
      mockQueryScan(undefined, items, {
        Limit: 10,
        TableName,
      });

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      return dynamo.getAllSecretsAndVersions({ limit: 10 })
        .then((res) => res.Items)
        .then((secrets) => {
          expect(secrets).toHaveLength(items.length);
          expect(secrets).toEqual(items);
        });
    });
  });

  describe('#getAllVersions', () => {
    test('should properly page through many results', () => {
      mockQueryScan(undefined, items, {
        Limit: 10,
        TableName,
      });

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      return dynamo.getAllVersions('', { limit: 10 })
        .then((res) => res.Items)
        .then((secrets) => {
          expect(secrets).toHaveLength(items.length);
          expect(secrets).toEqual(items);
        });
    });
  });

  describe('#getLatestVersion', () => {
    test('should only get one item back', async () => {
      mockQueryScan(undefined, items, {
        Limit: 1,
        TableName,
      });

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      const res = await dynamo.getLatestVersion('');
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

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      const res = await dynamo.getByVersion(name, version);
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
      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      await expect(dynamo.createSecret(item)).resolves.toBe('Success');
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

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      await expect(dynamo.deleteSecret(name, version)).resolves.toBe('Success');
    });
  });

  describe('#createTable', () => {
    test('should create the table with the HASH as name and RANGE as version', async () => {
      mockDdb.on(DescribeTableCommand)
        .rejectsOnce(new ResourceNotFoundException({}))
        .resolves({
          Table: { TableStatus: 'ACTIVE' },
        });
      mockDdb.on(CreateTableCommand).callsFake((params) => {
        expect(params.TableName).toBe(TableName);
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

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      await expect(dynamo.createTable()).resolves.not.toThrow();
      expect(mockDdb.commandCalls(CreateTableCommand)).toHaveLength(1);
    }, 5e3);

    test('should not create a table if one exists', async () => {
      mockDdb.on(DescribeTableCommand).resolves({});
      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      await expect(dynamo.createTable()).resolves.not.toThrow();
      expect(mockDdb.commandCalls(CreateTableCommand)).toHaveLength(0);
    });

    test('should throw any exception that is not ResourceNotFoundException', async () => {
      mockDdb.on(DescribeTableCommand).rejects(new Error('Error'));
      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      await expect(dynamo.createTable()).rejects.toThrow('Error');
      expect(mockDdb.commandCalls(CreateTableCommand)).toHaveLength(0);
    });
  });
});
