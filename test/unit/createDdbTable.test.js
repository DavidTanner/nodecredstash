const AWS = require('aws-sdk-mock');
const { defCredstash } = require('./utils/general');

beforeEach(() => {
  AWS.restore();
});

afterEach(() => {
  AWS.restore();
});

test('should call createTable with the table name provided', async () => {
  const table = 'TableNameNonDefault';
  AWS.mock('DynamoDB', 'describeTable', (params, cb) => {
    expect(params).toHaveProperty('TableName', table);
    cb();
  });
  const credstash = defCredstash({ table });
  await expect(credstash.createDdbTable()).resolves.not.toThrow();
});
