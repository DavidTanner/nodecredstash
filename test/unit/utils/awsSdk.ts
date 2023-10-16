import { afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { KMSClient } from '@aws-sdk/client-kms';

export const mockKms = mockClient(KMSClient);
export const mockDdb = mockClient(DynamoDBClient);
export const mockDocClient = mockClient(DynamoDBDocumentClient);

afterEach(() => {
  mockKms.reset();
  mockDdb.reset();
  mockDocClient.reset();
});
