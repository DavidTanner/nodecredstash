const { DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const defaults = require('../../src/defaults');

const { defCredstash } = require('./utils/general');
const { mockDdb } = require('./utils/awsSdk');

test('has methods to match credstash', () => {
  const credstash = defCredstash();
  expect(credstash).toHaveProperty('paddedInt');
  expect(credstash).toHaveProperty('getHighestVersion');
  expect(credstash).toHaveProperty('listSecrets');
  expect(credstash).toHaveProperty('putSecret');
  expect(credstash).toHaveProperty('getAllSecrets');
  expect(credstash).toHaveProperty('getAllVersions');
  expect(credstash).toHaveProperty('getSecret');
  expect(credstash).toHaveProperty('deleteSecrets');
  expect(credstash).toHaveProperty('createDdbTable');
});

test('should use a callback if provided', (done) => {
  const table = 'TableNameNonDefault';
  mockDdb.on(DescribeTableCommand).resolves();
  const credstash = defCredstash({ table });
  credstash.createDdbTable((err) => {
    try {
      expect(err).toBeUndefined();
      expect(mockDdb.commandCalls(DescribeTableCommand, { TableName: table })).toHaveLength(1);
      done();
    } catch (e) {
      done(e);
    }
  });
});

test('should use a callback for errors, and not throw an exception', (done) => {
  const table = 'TableNameNonDefault';
  mockDdb.on(DescribeTableCommand).rejects('Error');
  const credstash = defCredstash({ table });
  credstash.createDdbTable((err) => {
    expect(err).toBeDefined();
    expect(err).toHaveProperty('message', 'Error');
    expect(mockDdb.commandCalls(DescribeTableCommand, { TableName: table })).toHaveLength(1);
  })
    .then(done);
});

test('should return the configuration', () => {
  const region = 'us-east-1';
  const credstash = defCredstash();
  const newConfig = credstash.getConfiguration();
  expect(newConfig).toEqual({
    config: {
      awsOpts: {
        region,
      },
    },
    dynamoConfig: {
      table: defaults.DEFAULT_TABLE,
      opts: {
        region,
      },
    },
    kmsConfig: {
      kmsKey: defaults.DEFAULT_KMS_KEY,
      opts: {
        region,
      },
    },
  });
});

test('should allow separate options for KMS and DynamoDB', () => {
  const region = 'us-east-1';

  const dynamoOpts = {
    region: 'us-west-1',
    endpoint: 'https://service1.region.amazonaws.com',
  };

  const kmsOpts = {
    region: 'us-west-2',
    endpoint: 'https://service2.region.amazonaws.com',
  };

  const credstash = defCredstash({
    dynamoOpts,
    kmsOpts,
  });
  const newConfig = credstash.getConfiguration();
  expect(newConfig).toEqual({
    config: {
      dynamoOpts,
      kmsOpts,
      awsOpts: {
        region,
      },
    },
    dynamoConfig: {
      table: defaults.DEFAULT_TABLE,
      opts: dynamoOpts,
    },
    kmsConfig: {
      kmsKey: defaults.DEFAULT_KMS_KEY,
      opts: kmsOpts,
    },
  });
});
