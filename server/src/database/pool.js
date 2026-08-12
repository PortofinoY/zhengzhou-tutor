function createMysqlPool(config, options = {}) {
  const mysql = options.mysql || require('mysql2/promise');
  return mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    connectionLimit: config.connectionLimit,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    dateStrings: true,
    decimalNumbers: true,
    ssl: config.sslEnabled ? { rejectUnauthorized: true } : undefined
  });
}

module.exports = {
  createMysqlPool
};
