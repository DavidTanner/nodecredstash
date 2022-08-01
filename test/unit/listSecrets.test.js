const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { defCredstash } = require('./utils/general');
const { mockDocClient } = require('./utils/awsSdk');

test('should return all secret names and versions', async () => {
  const items = [{ name: 'name', version: 'version1' }, { name: 'name', version: 'version2' }];
  mockDocClient.on(ScanCommand).resolves({ Items: items });
  const credstash = defCredstash();
  await expect(credstash.listSecrets()).resolves.toEqual(items);
});
