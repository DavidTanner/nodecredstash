nodecredstash
=============

[![Build Status](https://github.com/DavidTanner/nodecredstash/actions/workflows/release.yaml/badge.svg)](https://github.com/DavidTanner/nodecredstash/actions/workflows/release.yaml)
[![npm version](https://badge.fury.io/js/nodecredstash.svg)](https://badge.fury.io/js/nodecredstash)

[Node.js](https://nodejs.org/en/) port of [credstash](https://github.com/fugue/credstash)

=============

    $ npm i --save nodecredstash

```js
let Credstash = require('nodecredstash');

let credstash = new Credstash();

credstash.putSecret({name: 'Death Star vulnerability', secret: 'Exhaust vent', version: 1, context: {rebel: 'true'}})
  .then(() => credstash.getSecret({name: 'Death Star vulnerability', version: 1, context: {rebel: 'true'}})
  .then(secret => console.log(secret));
```


Options
=======


[dynamoOpts](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-dynamodb/interfaces/dynamodbclientconfig.html)
----------
Options that are specific to the DynamoDB configuration.



[kmsOpts](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-kms/interfaces/kmsclientconfig.html)
----------
Options that are specific to the KMS configuration.


General function arguments
==========================

tableName
-----
The DynamoDB table where credentials are stored
default: `credential-store`


kmsKey
------
The name of the [KMS key](http://docs.aws.amazon.com/kms/latest/developerguide/create-keys.html) created for credstash.
default: `alias/credstash`


[context](http://docs.aws.amazon.com/kms/latest/developerguide/encryption-context.html)
---------------------------------------------------------------------------------------
Context for encrypting and decrypting secrets with KMS.


Function arguments
==================

name
----
The name of the secret that will be stored in DynamoDB


[version](https://github.com/fugue/credstash#versioning-secrets)
----------------------------------------------------------------
Can be a string or number. If it is a number, then nodecredstash will pad it with 0s so it can be sorted.


cb
---
An optional callback function when you don't want to use promises;

```js
credstash.getSecret({
      name: 'Death Star plans',
      context: {rebelShip: 'true'}
    }, (err, res) => {
    if (err) {
      throw new Error('The Death Star plans are not in the main computer.');
    }
    ...
})
```

Functions
=========

.createDdbTable([{[tableName], [kmsKey]}], [cb])
-----------------
Create the table in DynamoDB using the [table](table) option



.putSecret({name, secret, [version], [context], [digest], [tableName], [kmsKey]}, [cb])
------------------------------------------------------
Encode a secret and place it in DynamoDB.

```js
credstash.putSecret({
  name: 'Death Star Vulnerability',
  secret: 'Exhaust vent',
  context: { rebel: 'true'}
});
```

DynamoDB will now contain a record for this entry that looks like:
```json5
{
  "name": "Death Star Vulnerability", //
  "key": "...", // The value sent to KMS to retrieve the decryption key
  "version": "0000000000000000001", // The version string, should be sorteable
  "hmac": "...", // An HMAC validation value
  "contents": "..." // The AES 128 encrypted value
}
```


getHighestVersion({name, [tableName], [kmsKey]}, [cb])
-------------------------------
Returns the first sorted result for the given name key.


incrementVersion({name, [tableName], [kmsKey]}, [cb])
------------------------------
Returns the next incremented version version for the given name key.


.getSecret({name, [version], [context], [tableName], [kmsKey]}, [cb])
----------------------------------------------
Retrieve a decrypted secret from DynamoDB.

```js
credstash.getSecret({name: 'Death Star Vulnerability', context: {rebelDroid: 'true'}})
  .then(secrets => console.log(JSON.stringify(secrets, null, 2)));
```

```json5
{
  "Death Star Vulnerability": "Exhaust vent"
}
```


.getAllSecrets({[version], [context], [startsWith], [tableName], [kmsKey]}, [cb])
--------------------------------------------
Retrieve all decrypted secrets from DynamoDB.

The **startsWith** option will filter the response

```js
credstash.getAllSecrets({context: {rebel: 'true'}})
  .then(secrets => console.log(JSON.stringify(secrets, null, 2)));
```

```json5
{
  "Death Star vulnerability": "Exhaust vent"
}
```

.getAllVersions({name, [context], [limit], [tableName], [kmsKey]}, [cb])
--------------------------------------------

Retrieve all or the last N(limit) versions of a secret.

```js
credstash.getAllSecrets({name: 'Death Star vulnerability', limit: 2, context: {rebel: 'true'}})
  .then(secrets => console.log(JSON.stringify(secrets, null, 2)));
```


```json5
[ { "version": "0000000000000000006", "secret": "Exhaust vent" },
  { "version": "0000000000000000005", "secret": "Destroy vent" } ]
```


.listSecrets([{[tableName], [kmsKey]}], [cb])
------------------
Retrieve all stored secrets and their highest version

```js
credstash.listSecrets()
  .then(list => console.log(JSON.stringify(list, null, 2)));
```

```json5
[
  {
    "name": "Death Star",
    "version": "0000000000000000001"
  },
  {
    "name": "Death Star vulnerability",
    "version": "0000000000000000001"
  }
]
```



.deleteSecret({name, version, [tableName], [kmsKey]}, [cb])
------------------------------------
Delete the desired secret by version from DynamoDB

```js

credstash.deleteSecret({name: 'Death Star', version: 1})
// 'Deleting Death Star -- version 0000000000000000001'
  .then(() => credstash.list())
  .then(list => console.log(JSON.stringify(list, null, 2));
```

```json5
[
  {
    "name": "Death Star vulnerability",
    "version": "0000000000000000001"
  }
]
```



.deleteSecrets({name, [tableName], [kmsKey]}, [cb])
---------------------
Deletes all of the versions of `name`

```js

credstash.deleteSecrets({name: 'Death Star vulnerability'})
// 'Deleting Death Star vulnerability -- version 0000000000000000001'
  .then(() => credstash.listSecrets())
  .then(list => console.log(JSON.stringify(list, null, 2));
```

```json5
[]
```
