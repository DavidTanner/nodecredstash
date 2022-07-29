const AWS = require('aws-sdk-mock');
const { defCredstash } = require('./utils/general');

beforeEach(() => {
  AWS.restore();
});

afterEach(() => {
  AWS.restore();
});

test('should return all secret names and versions', () => {
  const items = [{ name: 'name', version: 'version1' }, { name: 'name', version: 'version2' }];
  AWS.mock('DynamoDB.DocumentClient', 'scan', (params, cb) => cb(undefined, { Items: items }));
  const credstash = defCredstash();
  return credstash.listSecrets()
    .then((results) => {
      expect(results).toEqual(items);
    });
});
