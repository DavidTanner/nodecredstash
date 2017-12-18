'use strict';

/* eslint-disable no-unused-expressions, no-undef */

require('../../test/setup');

const _ = require('lodash');

const DynamoDb = require('../dynamoDb');

const AWS = require('aws-sdk-mock');

function findKeyIndex(items, keys) {
  const index = items.findIndex((item) => {
    let matches = true;
    _.forEach(keys, (value, key) => {
      matches = matches && item[key] == value;
    });
    return matches;
  });
  return index;
}

function sliceItems(items, params) {
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
}

function compareParams(actual, expected) {
  if (expected.TableName) {
    actual.TableName.should.eql(expected.TableName);
  }
  if (expected.ExpressionAttributeNames) {
    actual.ExpressionAttributeNames.should.eql(expected.ExpressionAttributeNames);
  }
  if (expected.KeyConditionExpression) {
    actual.KeyConditionExpression.should.eql(expected.KeyConditionExpression);
  }

  if (expected.ProjectionExpression) {
    actual.ProjectionExpression.should.eql(expected.ProjectionExpression);
  }

  if (expected.Limit) {
    expect(actual.Limit).to.exist;
    actual.Limit.should.eql(expected.Limit);
  }

  if (expected.ExpressionAttributeValues) {
    actual.ExpressionAttributeValues.should.eql(expected.ExpressionAttributeValues);
  }
}

function mockQueryScan(error, items, expectedParams) {
  function fn(params, done) {
    compareParams(params, expectedParams);
    const results = sliceItems(items, params);

    done(error, results);
  }

  AWS.mock('DynamoDB.DocumentClient', 'query', fn);

  AWS.mock('DynamoDB.DocumentClient', 'scan', fn);
}


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
    it('should properly page through many results', () => {
      mockQueryScan(undefined, items, {
        Limit: 10,
        TableName,
      });

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      return dynamo.getAllSecretsAndVersions({ limit: 10 })
        .then(res => res.Items)
        .then((secrets) => {
          secrets.length.should.be.equal(items.length);
          secrets.should.eql(items);
        });
    });
  });

  describe('#getAllVersions', () => {
    it('should properly page through many results', () => {
      mockQueryScan(undefined, items, {
        Limit: 10,
        TableName,
      });

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      return dynamo.getAllVersions('', { limit: 10 })
        .then(res => res.Items)
        .then((secrets) => {
          secrets.length.should.be.equal(items.length);
          secrets.should.eql(items);
        });
    });
  });

  describe('#getLatestVersion', () => {
    it('should only get one item back', () => {
      mockQueryScan(undefined, items, {
        Limit: 1,
        TableName,
      });

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      return dynamo.getLatestVersion('')
        .then((res) => {
          expect(res).to.exist;
          expect(res.Items).to.exist;
          expect(res.Items[0]).to.exist;
          res.Items[0].should.equal(items[0]);
        });
    });
  });


  describe('#getByVersion', () => {
    it('should only get one item back', () => {
      const name = 'name';
      const version = 'version';
      AWS.mock('DynamoDB.DocumentClient', 'get', (params, cb) => {
        params.TableName.should.equal(TableName);
        expect(params.Key).to.exist;
        params.Key.name.should.equal(name);
        params.Key.version.should.equal(version);
        cb(undefined, { Item: 'Success' });
      });

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      return dynamo.getByVersion(name, version)
        .then((res) => {
          expect(res).to.exist;
          res.Item.should.equal('Success');
        });
    });
  });

  describe('#createSecret', () => {
    it('should create an item in DynamoDB', () => {
      const item = items[0];
      AWS.mock('DynamoDB.DocumentClient', 'put', (params, cb) => {
        params.TableName.should.equal(TableName);
        expect(params.ConditionExpression).to.exist;
        params.ConditionExpression.should.equal('attribute_not_exists(#name)');
        expect(params.ExpressionAttributeNames).to.exist;
        params.ExpressionAttributeNames.should.deep.equal({
          '#name': 'name',
        });
        params.Item.should.deep.equal(item);
        cb(undefined, 'Success');
      });
      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      return dynamo.createSecret(item)
        .then(res => res.should.equal('Success'));
    });
  });


  describe('#deleteSecret', () => {
    it('should delete the secret by name and version', () => {
      const name = 'name';
      const version = 'version';
      AWS.mock('DynamoDB.DocumentClient', 'delete', (params, cb) => {
        params.TableName.should.equal(TableName);
        expect(params.Key).to.exist;
        params.Key.name.should.equal(name);
        params.Key.version.should.equal(version);
        cb(undefined, 'Success');
      });

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      return dynamo.deleteSecret(name, version)
        .then((secret) => {
          expect(secret).to.exist;
          secret.should.equal('Success');
        });
    });
  });

  describe('#createTable', () => {
    it('should create the table with the HASH as name and RANGE as version', function () {
      this.timeout(5e3);
      AWS.mock('DynamoDB', 'describeTable', (params, cb) => cb({ code: 'ResourceNotFoundException' }));
      AWS.mock('DynamoDB', 'createTable', (params, cb) => {
        expect(params.TableName).to.exist;
        params.TableName.should.equal(TableName);
        expect(params.KeySchema).to.exist;
        expect(params.KeySchema.find).to.exist;
        params.KeySchema.length.should.equal(2);

        const hash = params.KeySchema.find(next => next.KeyType == 'HASH');
        expect(hash).to.exist;
        hash.should.deep.equal({
          AttributeName: 'name',
          KeyType: 'HASH',
        });
        const range = params.KeySchema.find(next => next.KeyType == 'RANGE');
        expect(range).to.exist;
        range.should.deep.equal({
          AttributeName: 'version',
          KeyType: 'RANGE',
        });
        expect(params.AttributeDefinitions).to.exist;
        expect(params.AttributeDefinitions.find).to.exist;
        params.AttributeDefinitions.length.should.equal(2);
        const name = params.AttributeDefinitions.find(next => next.AttributeName == 'name');
        expect(name).to.exist;
        name.should.deep.equal({
          AttributeName: 'name',
          AttributeType: 'S',
        });
        const version = params.AttributeDefinitions.find(next => next.AttributeName == 'version');
        expect(version).to.exist;
        version.should.deep.equal({
          AttributeName: 'version',
          AttributeType: 'S',
        });
        expect(params.ProvisionedThroughput).to.exist;
        params.ProvisionedThroughput.should.deep.equal({
          ReadCapacityUnits: 1,
          WriteCapacityUnits: 1,
        });
        cb();
      });
      AWS.mock('DynamoDB', 'waitFor', (status, params, cb) => {
        expect(status).to.exist;
        status.should.equal('tableExists');
        expect(params).to.exist;
        expect(params.TableName).to.exist;
        params.TableName.should.equal(TableName);
        cb();
      });

      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      return dynamo.createTable();
    });

    it('should not create a table if one exists', () => {
      AWS.mock('DynamoDB', 'describeTable', (params, cb) => cb());
      AWS.mock('DynamoDB', 'createTable', (params, cb) => {
        expect(params).to.not.exist;
        cb();
      });
      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      return dynamo.createTable();
    });


    it('should throw any exception that is not ResourceNotFoundException', () => {
      AWS.mock('DynamoDB', 'describeTable', (params, cb) => cb(new Error('Error')));
      AWS.mock('DynamoDB', 'createTable', (params, cb) => {
        expect(params).to.not.exist;
        cb(new Error('Error'));
      });
      dynamo = new DynamoDb(TableName, { region: 'us-east-1' });
      return dynamo.createTable()
        .then(() => {
          throw new Error('Should not reach here');
        })
        .catch(err => err.message.should.equal('Error'));
    });
  });
});
