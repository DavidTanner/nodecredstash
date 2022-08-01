const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { KMSClient } = require('@aws-sdk/client-kms');

const mockKms = mockClient(KMSClient);
const mockDdb = mockClient(DynamoDBClient);
const mockDocClient = mockClient(DynamoDBDocumentClient);

afterEach(() => {
  mockKms.reset();
  mockDdb.reset();
  mockDocClient.reset();
});

module.exports = {
  mockKms,
  mockDdb,
  mockDocClient,
};
