const {
  DynamoDBClient,
  DescribeTableCommand,
  CreateTableCommand,
  waitUntilTableExists, ResourceNotFoundException,
} = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
  GetCommand,
} = require('@aws-sdk/lib-dynamodb');

const debug = require('debug')('credstash');

const { pause } = require('./utils');

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

function DynamoDB(TableName, awsOpts) {
  const awsConfig = Object.assign({}, awsOpts);
  const ddb = new DynamoDBClient(awsConfig);
  const docClient = DynamoDBDocumentClient.from(ddb);

  function createAllVersionsQuery(name, Limit) {
    const params = {
      TableName,
      ConsistentRead: true,
      ScanIndexForward: false,
      KeyConditionExpression: '#name = :name',
      ExpressionAttributeNames: {
        '#name': 'name',
      },
      Limit,
      ExpressionAttributeValues: {
        ':name': name,
      },
    };
    return params;
  }

  this.getAllVersions = async (name, opts = {}) => {
    let LastEvaluatedKey;
    let curr;
    do {
      const params = createAllVersionsQuery(name, opts.limit);
      const next = await docClient.send(new QueryCommand({
        ...params,
        ExclusiveStartKey: LastEvaluatedKey,
      }));
      curr = combineResults(curr, next);
      ({ LastEvaluatedKey } = next);
    } while (LastEvaluatedKey);

    return curr;
  };

  this.getAllSecretsAndVersions = async ({ limit } = {}) => {
    let LastEvaluatedKey;
    let curr;
    do {
      const cmd = new ScanCommand({
        TableName,
        Limit: limit,
        ProjectionExpression: '#name, #version',
        ExclusiveStartKey: LastEvaluatedKey,
        ExpressionAttributeNames: {
          '#name': 'name',
          '#version': 'version',
        },
      });
      const next = await docClient.send(cmd);
      curr = combineResults(curr, next);
      ({ LastEvaluatedKey } = next);
    } while (LastEvaluatedKey);

    return curr;
  };

  this.getLatestVersion = (name) => {
    const params = createAllVersionsQuery(name, 1);
    return docClient.send(new QueryCommand(params));
  };

  this.getByVersion = (name, version) => {
    const params = {
      TableName,
      Key: { name, version },
    };
    return docClient.send(new GetCommand(params));
  };

  this.createSecret = async (item) => {
    const params = {
      Item: item,
      ConditionExpression: 'attribute_not_exists(#name)', // Never update an existing key
      TableName,

      ExpressionAttributeNames: {
        '#name': 'name',
      },
    };
    const result = await docClient.send(new PutCommand(params));
    return result;
  };

  this.deleteSecret = (name, version) => {
    const params = {
      TableName,
      Key: { name, version },
    };
    return docClient.send(new DeleteCommand(params));
  };

  this.createTable = async () => {
    const createTableCommand = new CreateTableCommand({
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

    try {
      await ddb.send(new DescribeTableCommand({ TableName }));
      debug('Credential Store table already exists');
    } catch (err) {
      if (!(err instanceof ResourceNotFoundException)) {
        throw err;
      }
      debug('Creating table...');
      await ddb.send(createTableCommand);
      debug('Waiting for table to be created...');
      await pause(2e3);
      await waitUntilTableExists({ client: ddb, maxWaitTime: 900 }, { TableName });
      debug('Table has been created');
      debug('Please go to the README to learn how to create your KMS key');
    }
  };
}

module.exports = DynamoDB;
