const {sails} = global
const co = require('co')
const mysql = require('mysql')
const connInfo = sails && (sails.config.MariaDBInfo || sails.config.connections.MariaDBInfo)
if (!connInfo) return

const connectionPool = mysql.createPool(connInfo)

const type = {':': '?', ';': '??'}
const re = /([:;$#])([a-zA-Z_]+[a-zA-Z0-9_]*)/g

function parseSql (str, params) {
  if (!params) return [str, []]
  let values = []
  let sql = (str || '').replace(re, function (m, $1, $2) {
    if ($1 === '$') return params[$2] ? mysql.escape(params[$2]) : ''
    if ($1 === '#') return params[$2] ? params[$2] : ''
    values.push(params[$2])
    return type[$1]
  })
  return [sql, values]
}

function promisify (fn, that) {
  return function (...args) {
    return new Promise((resolve, reject) => fn.apply(that, [...args, (err, result) => err ? reject(err) : resolve(result)]))
  }
}

function promisifyConnection (connection) {
  return {
    query (sql, params) {
      let [sqlString, values] = parseSql(sql, params)
      return promisify(connection.query, connection)(sqlString, values).catch(error => Promise.reject(new Error([sql, params, error])))
    },
    beginTransaction: promisify(connection.beginTransaction, connection),
    commit: promisify(connection.commit, connection),
    rollback: promisify(connection.rollback, connection),
    release: () => connection.release()
  }
}

module.exports = function (gen) {
  return co(function * () {
    let connection = yield promisify(connectionPool.getConnection, connectionPool)()
    yield promisify(connection.beginTransaction, connection)()
    return promisifyConnection(connection)
  }).then(conn => co(function * () {
    try {
      let res = yield * gen(conn)
      if (res instanceof Promise) res = yield res
      yield conn.commit()
      conn.release()
      return res
    } catch (e) {
      let err = e
      yield conn.rollback().catch(e => { err = [err, e] })
      conn.release()
      return Promise.reject(err)
    }
  }))
}
