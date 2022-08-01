const { DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const { defCredstash } = require('./utils/general');
const { mockDdb } = require('./utils/awsSdk');

test('should call createTable with the table name provided', async () => {
  const table = 'TableNameNonDefault';
  mockDdb.on(DescribeTableCommand).resolves();
  const credstash = defCredstash({ table });
  await expect(credstash.createDdbTable()).resolves.not.toThrow();
  expect(mockDdb.commandCalls(DescribeTableCommand, { TableName: table })).toHaveLength(1);
});
