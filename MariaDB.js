const {sails} = global
const co = require('co')
const mysql = require('mysql')
const connInfo = sails && (sails.config.MariaDBInfo || sails.config.connections.MariaDBInfo)
if (!connInfo) throw new Error('sails-mariadb : no MariaDBInfo')

const connectionPool = mysql.createPool(connInfo)

const type = {':': '?', ';': '??'}
const re = /([:;$#])([a-zA-Z_]+[a-zA-Z0-9_]*)/g

function parseSql (str, params) {
  if (!(params instanceof Object)) return [str, []]
  let values = []
  let sql = (str || '').replace(re, function (m, $1, $2) {
    if ($1 === '$') return params[$2] ? mysql.escape(params[$2]) : ''
    if ($1 === '#') return params[$2] ? params[$2] : ''
    values.push(params[$2])
    return type[$1]
  })
  return [sql, values]
}

function promisify (that, fn) {
  return (...args) => new Promise((resolve, reject) =>
    fn.apply(that, [...args, (err, result) => err ? reject(err) : resolve(result)])
  )
}

function promisifyConnection (connection) {
  if (connection.hasOwnProperty('prototype')) return connection
  let {beginTransaction, commit, rollback, query, changeUser, on, ping, release, destroy} = connection
  let _ = fn => promisify(connection, fn)
  let that = fn => (...args) => fn.apply(connection, args)

  let _query = _(query)
  return Object.assign(Object.create(connection, {prototype: {value: connection}}), {
    _promisify: _,
    _bind: that,
    query: (sql, params) => _query(...parseSql(sql, params)).catch(error => Promise.reject(new Error([sql, params, error]))),
    beginTransaction: _(beginTransaction),
    commit: _(commit),
    rollback: _(rollback),
    changeUser: _(changeUser),
    on: _(on),
    ping: _(ping),
    release: that(release),
    destroy: that(destroy)
  })
  // NOTE: If want to call that not own method of this object,
  // please use 'conn.prototype.foo(...args)'
}

function isPromise (obj) { // from 'co'
  return obj && typeof obj.then === 'function'
}

function MariaDB (gen) {
  return co(function * () {
    let connection = yield promisify(connectionPool, connectionPool.getConnection)()
    let conn = promisifyConnection(connection)
    yield conn.beginTransaction()
    return conn
  }).then(conn => co(function * () {
    try {
      let res = yield * gen(conn)
      if (isPromise(res)) res = yield res
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

module.exports = MariaDB
module.exports.MariaDB = MariaDB
module.exports.MariaDBInfo = connInfo
module.exports.mysql = mysql
