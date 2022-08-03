import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';

import { mockDdb } from './utils/awsSdk';
import { CredStash } from '../../src';
import { DEFAULT_TABLE } from '../../src/defaults';

test('should call createTable', async () => {
  const table = 'TableNameNonDefault';
  mockDdb.on(DescribeTableCommand).resolves({});
  const credStash = new CredStash({ table });
  await expect(credStash.createDdbTable({})).resolves.not.toThrow();
  await expect(credStash.createDdbTable({})).resolves.not.toThrow();
  expect(mockDdb.commandCalls(DescribeTableCommand, { TableName: DEFAULT_TABLE })).toHaveLength(2);

  await expect(credStash.createDdbTable({ tableName: table })).resolves.not.toThrow();
  expect(mockDdb.commandCalls(DescribeTableCommand, { TableName: table })).toHaveLength(1);
});
