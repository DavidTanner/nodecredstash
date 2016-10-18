nodecredstash
=============

[![Build Status](https://travis-ci.org/DavidTanner/nodecredstash.svg?branch=master)](https://travis-ci.org/DavidTanner/nodecredstash)
[![Coverage Status](https://coveralls.io/repos/github/DavidTanner/nodecredstash/badge.svg?branch=master)](https://coveralls.io/github/DavidTanner/nodecredstash?branch=master)
[![npm version](https://badge.fury.io/js/nodecredstash.svg)](https://badge.fury.io/js/nodecredstash)
[![dependencies](https://img.shields.io/david/DavidTanner%2Fnodecredstash.svg)](https://www.npmjs.com/package/nodecredstash)

[Node.js](https://nodejs.org/en/) port of [credstash](https://github.com/fugue/credstash)

=============

    $ npm install --save nodecredstash
    
```js
let Credstash = require('nodecredstash');

let credstash = new Credstash({table: 'credentials-store', awsOpts: {region: 'us-west-2'});

credstash.putSecret({name: 'Death Star vulnerability', secret: 'Exhaust vent', version: 1, context: {rebel: 'true'}})
  .then(() => credstash.getSecret({name: 'Death Star vulnerability', version: 1, context: {rebel: 'true'}})
  .then(secret => console.log(secret));
```
  
  
Options
=======


table
-----
The DynamoDB table to store credentials
default: `credential-store`


kmsKey
------
The name of the [KMS key](http://docs.aws.amazon.com/kms/latest/developerguide/create-keys.html) created for credstash.
default: `alias/credstash`


awsOpts
-------
Options to be passed to the [aws-sdk](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-services.html) instance for DynamoDB and KMS
`region` can be sent in as a parameter, or you can follow other [AWS conventions](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html) for setting the region
ex: 
```
{
  "region": "us-east-1"
}
```

Function arguments
==================

name
----
The name of the secret that will be stored in DynamoDB


[version](https://github.com/fugue/credstash#versioning-secrets)
----------------------------------------------------------------
Can be a string or number. If it is a number, then nodecredstash will pad it with 0s so it can be sorted.


[context](http://docs.aws.amazon.com/kms/latest/developerguide/encryption-context.html)
---------------------------------------------------------------------------------------
Used to get the encryption key from KMS.


cb
---
An optional callback function when you don't want to use promises;

```js
credstash.getSecret({
      name: 'Death Star plans', 
      context: {rebelShip: 'true'}
    }, function(err, res) {
    if (err) {
      throw new Error('The Death Star plans are not in the main computer.');
    }
    ...
})
```

Functions
=========

.createDdbTable([cb])
-----------------
Create the table in DynamoDB using the [table](table) option



.putSecret({name, secret, [version], [context]}, [cb])
------------------------------------------------------
Encode a secret and place it in DynamoDB.

```js
credstash.putSecret({name: 'Death Star Vulnerability', context: { rebel: 'true'}});
```

DynamoDB will now contain a record for this entry that looks like:
```js
{
  "name": "Death Star Vulnerability", //
  "key": "...", // The value sent to KMS to retrieve the decryption key
  "version": "0000000000000000001", // The version string, should be sorteable
  "hmac": "...", // An HMAC validation value
  "contents": "..." // The AES 128 encrypted value
}
```


getHighestVersion({name}, [cb])
-------------------------------
Returns the first sorted result for the given name key.


incrementVersion({name}, [cb])
------------------------------
Returns the next incremented version version for the given name key.


.getSecret({name, [version], [context]}, [cb])
----------------------------------------------
Retrieve a decrypted secret from DynamoDB.

```js
credstash.getSecret({name: 'Death Star Vulnerability', context: {rebelDroid: 'true'}})
  .then(secrets => console.log(JSON.stringify(secrets, null, 2)));
```

```js
{
  "Death Star Vulnerability": "Exhaust vent"
}
```


.getAllSecrets({[version], [context]}, [cb])
--------------------------------------------
Retrieve all decrypted secrets from DynamoDB.

```js
credstash.getAllSecrets({context: {rebel: 'true'}})
  .then(secrets => console.log(JSON.stringify(secrets, null, 2)));
```

```js
{
  "Death Star vulnerability": "Exhaust vent"
}
```


.listSecrets([cb])
------------------
Retrieve all stored secrets and their highest version

```js
credstash.listSecrets()
  .then(list => console.log(JSON.stringify(list, null, 2)));
```

```js
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



.deleteSecret({name, version}, [cb])
------------------------------------
Delete the desired secret by version from DynamoDB

```js

credstash.deleteSecret({name: 'Death Star', version: 1})
// 'Deleting Death Star -- version 0000000000000000001'
  .then(() => credstash.list())
  .then(list => console.log(JSON.stringify(list, null, 2));
```

```js
[
  {
    "name": "Death Star vulnerability",
    "version": "0000000000000000001"
  }
]
```



.deleteSecrets(name)
---------------------
Deletes all of the versions of `name`

```js

credstash.deleteAll({name: 'Death Star vulnerability'})
// 'Deleting Death Star vulnerability -- version 0000000000000000001'
  .then(() => credstash.list())
  .then(list => console.log(JSON.stringify(list, null, 2));
```

```js
[]
```




