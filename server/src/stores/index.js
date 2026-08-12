const { JsonStore } = require('./json-store');
const { MysqlStore } = require('./mysql-store');
const { createMysqlPool } = require('../database/pool');
const {
  resolveDataDriver,
  resolveMysqlConfig
} = require('../runtime-config');

function createDataStore(options = {}) {
  const environment = options.environment || process.env;
  const driver = options.driver || resolveDataDriver(environment);
  if (driver === 'json') {
    return new JsonStore(options.dbPath, {
      seedDemoData: options.seedDemoData,
      environment
    });
  }
  const mysqlConfig = options.mysqlConfig || resolveMysqlConfig(environment);
  const pool = options.pool || createMysqlPool(mysqlConfig, options);
  return new MysqlStore({
    pool,
    requiredSchemaVersion: options.requiredSchemaVersion,
    repositoryFactory: options.repositoryFactory
  });
}

module.exports = {
  createDataStore,
  JsonStore,
  MysqlStore
};
