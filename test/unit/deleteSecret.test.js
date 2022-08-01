const { DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { defCredstash } = require('./utils/general');
const { mockDocClient } = require('./utils/awsSdk');

const name = 'name';
const version = 'version';
const numVer = 42;

test.each([
  [undefined, 'name'],
  [{}, 'name'],
  [{ name: 'name' }, 'version'],
])('%# should reject missing params', async (deleteParams, missingParam) => {
  const credstash = defCredstash();
  await expect(credstash.deleteSecret(deleteParams)).rejects.toThrow(`${missingParam} is a required parameter`);
  expect(mockDocClient.commandCalls(DeleteCommand)).toHaveLength(0);
});

test('should delete the correct item', async () => {
  mockDocClient.on(DeleteCommand).resolves('Success');

  const credstash = defCredstash();
  await expect(credstash.deleteSecret({ name, version })).resolves.toBe('Success');
  expect(mockDocClient.commandCalls(DeleteCommand, { Key: { name, version } })).toHaveLength(1);
});

test('should convert numerical versions into strings', async () => {
  mockDocClient.on(DeleteCommand).resolves('Success');

  const credstash = defCredstash();
  await expect(credstash.deleteSecret({ name, version: numVer })).resolves.toBe('Success');
  expect(mockDocClient.commandCalls(DeleteCommand, {
    Key: { name, version: `00000000000000000${numVer}` },
  })).toHaveLength(1);
});
