'use strict';

const AWS = require('aws-sdk');

const debug = require('debug')('credstash');

const utils = require('./utils');

function combineResults(curr, next) {
  if (!curr) {
    return next;
  }

  const combined = Object.assign({}, next, {
    Items: curr.Items.concat(next.Items),
    Count: curr.Count + next.Count,
  });

  return combined;
}


function pageResults(that, fn, parameters, curr) {
  const params = Object.assign({}, parameters);

  if (curr) {
    params.ExclusiveStartKey = curr.LastEvaluatedKey;
  }
  return utils.asPromise(that, fn, params)
    .then((next) => {
      const combined = combineResults(curr, next);
      const nextStep = next.LastEvaluatedKey ? pageResults(that, fn, params, combined) : combined;
      return nextStep;
    });
}

function createAllVersionsQuery(table, name) {
  const params = {
    TableName: table,
    ConsistentRead: true,
    ScanIndexForward: false,
    KeyConditionExpression: '#name = :name',
    ExpressionAttributeNames: {
      '#name': 'name',
    },
    ExpressionAttributeValues: {
      ':name': name,
    },
  };
  return params;
}

function DynamoDB(table, awsOpts) {
  const awsConfig = Object.assign({}, awsOpts);
  const docClient = new AWS.DynamoDB.DocumentClient(awsConfig);
  const ddb = new AWS.DynamoDB(awsConfig);

  this.getAllVersions = (name, opts) => {
    const options = Object.assign({}, opts);
    const params = createAllVersionsQuery(table, name);
    params.Limit = options.limit;

    return pageResults(docClient, docClient.query, params);
  };


  this.getAllSecretsAndVersions = (opts) => {
    const options = Object.assign({}, opts);
    const params = {
      TableName: table,
      Limit: options.limit,
      ProjectionExpression: '#name, #version',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#version': 'version',
      },
    };
    return pageResults(docClient, docClient.scan, params);
  };

  this.getLatestVersion = (name) => {
    const params = createAllVersionsQuery(table, name);
    params.Limit = 1;

    return utils.asPromise(docClient, docClient.query, params);
  };

  this.getByVersion = (name, version) => {
    const params = {
      TableName: table,
      Key: { name, version },
    };
    return utils.asPromise(docClient, docClient.get, params);
  };

  this.createSecret = (item) => {
    const params = {
      Item: item,
      ConditionExpression: 'attribute_not_exists(#name)', // Never update an existing key
      TableName: table,

      ExpressionAttributeNames: {
        '#name': 'name',
      },
    };
    return utils.asPromise(docClient, docClient.put, params);
  };

  this.deleteSecret = (name, version) => {
    const params = {
      TableName: table,
      Key: { name, version },
    };
    return utils.asPromise(docClient, docClient.delete, params);
  };

  this.createTable = () => {
    const params = {
      TableName: table,
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
    };

    return utils.asPromise(ddb, ddb.describeTable, { TableName: table })
      .then(() => debug('Credential Store table already exists'))
      .catch((err) => {
        if (err.code != 'ResourceNotFoundException') {
          throw err;
        }
        debug('Creating table...');
        return utils.asPromise(ddb, ddb.createTable, params)
          .then(() => debug('Waiting for table to be created...'))
          .then(() => new Promise(resolve => setTimeout(resolve, 2e3)))
          .then(() => utils.asPromise(ddb, ddb.waitFor, 'tableExists', { TableName: table }))
          .then(() => debug('Table has been created ' +
            'Go read the README about how to create your KMS key'));
      });
  };
}

module.exports = DynamoDB;
