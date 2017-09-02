# Sails MariaDB
MariaDB service for sails.js server

 [![npm package](https://img.shields.io/npm/v/sails-mariadb.svg?maxAge=2592000)](https://www.npmjs.com/package/sails-mariadb)
 [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)


## Install
```bash
npm i sails-mariadb
```
## Usage
**config/connection.js**
```js
module.exports.connections = {
  //...
  MariaDBInfo: {
    host: 'localhost',
    user: 'root',
    password: 'pw',
    database: 'db',
    multipleStatements: true,
    connectionLimit: 10
  },
  //...
}
```
or sails.config.MariaDBInfo(higher priority)

node [mysql](https://www.npmjs.com/package/mysql) was used.  
same configuration

**In sails controller**
```js
const MariaDB = require('sails-mariadb')
MariaDB(function * (conn) {
  let rows = yield conn.query(`SELECT * FROM table WHERE id=:id`, {id: 10})
  let res = yield conn.query(`INSERT INTO table2 SET foo=:foo`, {foo: 'foo'})
  return {rows, affectedRows: res.affectedRows}
}).then(r => console.log(r), e => console.error(e))
```
[co](https://www.npmjs.com/package/co) was used. same usage.

`conn.query` returns promise.  
In generator function, all queries are in transaction.  
And will auto commit transaction if all promises are resolved in function  
and auto rollback if there's any promise rejection in function.(only promises with yield)

query result is same as [mysql](https://www.npmjs.com/package/mysql)

## Query Statement
`conn.query(sql, params)`  
In `sql` string
* `:variableName` - same as `?` in node [mysql](https://www.npmjs.com/package/mysql). target value is `params.variableName`.
* `;variableName` - same as `??` in node [mysql](https://www.npmjs.com/package/mysql). target value is `params.variableName`.
* `$variableName` - replace `$variableName` as `params.variableName` with escaped string in sql string.
* `#variableName` - replace `#variableName` as `params.variableName` with raw string in sql string. **(unsafe!)**


## License
The MIT License (MIT)  
Copyright (c) 2017 Elevista