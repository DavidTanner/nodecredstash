const _ = require('lodash');

const AWS = require('aws-sdk-mock');
const DynamoDb = require('../../../src/lib/dynamoDb');

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
  const fn = (params, done) => {
    compareParams(params, expectedParams);
    const results = sliceItems(items, params);

    done(error, results);
  };

  AWS.mock('DynamoDB.DocumentClient', 'query', fn);

  AWS.mock('DynamoDB.DocumentClient', 'scan', fn);
};

describe('dynmaodDb', () => {
  let dynamo;
  let items;
  const TableName = 'credentials-store';

  beforeEach(() => {
    AWS.restore();
    items = Array.from({ length: 30 }, (v, i) => ({ name: i, version: i }));
  });

  afterEach(() => {
    AWS.restore();
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
    test('should only get one item back', () => {
      mockQueryScan(undefined, items, {
        Limit: 1,
        TableName,
      });

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      return dynamo.getLatestVersion('')
        .then((res) => {
          expect(res).toBeDefined();
          expect(res.Items).toBeDefined();
          expect(res.Items[0]).toBeDefined();
          expect(res.Items[0]).toBe(items[0]);
        });
    });
  });

  describe('#getByVersion', () => {
    test('should only get one item back', () => {
      const name = 'name';
      const version = 'version';
      AWS.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
        expect(params).toHaveProperty('TableName', TableName);
        expect(params.Key).toBeDefined();
        expect(params.Key).toHaveProperty(name, name);
        expect(params.Key).toHaveProperty(version, version);
        cb(undefined, { Item: 'Success' });
      });

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      return dynamo.getByVersion(name, version)
        .then((res) => {
          expect(res).toBeDefined();
          expect(res.Item).toBe('Success');
        });
    });
  });

  describe('#createSecret', () => {
    test('should create an item in DynamoDB', async () => {
      const item = items[0];
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => {
        expect(params.TableName).toBe(TableName);
        expect(params.ConditionExpression).toBeDefined();
        expect(params.ConditionExpression).toBe('attribute_not_exists(#name)');
        expect(params.ExpressionAttributeNames).toBeDefined();
        expect(params.ExpressionAttributeNames).toEqual({
          '#name': 'name',
        });
        expect(params.Item).toEqual(item);
        cb(undefined, 'Success');
      });
      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      await expect(dynamo.createSecret(item)).resolves.toBe('Success');
    });
  });

  describe('#deleteSecret', () => {
    test('should delete the secret by name and version', async () => {
      const name = 'name';
      const version = 'version';
      AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => {
        expect(params.TableName).toBe(TableName);
        expect(params.Key).toBeDefined();
        expect(params.Key).toHaveProperty(name, name);
        expect(params.Key).toHaveProperty(version, version);
        cb(undefined, 'Success');
      });

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      await expect(dynamo.deleteSecret(name, version)).resolves.toBe('Success');
    });
  });

  describe('#createTable', () => {
    test('should create the table with the HASH as name and RANGE as version', async () => {
      AWS.mock('DynamoDB', 'describeTable', (params, cb) => cb({ code: 'ResourceNotFoundException' }));
      AWS.mock('DynamoDB', 'createTable', (params, cb) => {
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
        cb();
      });
      AWS.mock('DynamoDB', 'waitFor', (status, params, cb) => {
        expect(status).toBeDefined();
        expect(status).toBe('tableExists');
        expect(params).toBeDefined();
        expect(params.TableName).toBeDefined();
        expect(params.TableName).toBe(TableName);
        cb();
      });

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      await expect(dynamo.createTable()).resolves.not.toThrow();
    }, 5e3);

    test('should not create a table if one exists', async () => {
      AWS.mock('DynamoDB', 'describeTable', (params, cb) => cb());
      AWS.mock('DynamoDB', 'createTable', (params, cb) => {
        expect(params).toBeUndefined();
        cb();
      });
      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      await expect(dynamo.createTable()).resolves.not.toThrow();
    });

    test('should throw any exception that is not ResourceNotFoundException', async () => {
      AWS.mock('DynamoDB', 'describeTable', (params, cb) => cb(new Error('Error')));
      AWS.mock('DynamoDB', 'createTable', (params, cb) => {
        expect(params).toBeUndefined();
        cb(new Error('Error'));
      });
      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      await expect(dynamo.createTable()).rejects.toThrow('Error');
    });
  });
});
