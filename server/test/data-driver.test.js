const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveDataDriver,
  resolveMysqlConfig,
  validateDataConfiguration
} = require('../src/runtime-config');

test('production requires the mysql data driver', () => {
  assert.throws(
    () => validateDataConfiguration({ NODE_ENV: 'production', DATA_DRIVER: 'json' }),
    /production.*DATA_DRIVER=mysql/i
  );
  assert.equal(resolveDataDriver({ NODE_ENV: 'production', DATA_DRIVER: 'mysql' }), 'mysql');
});

test('production requires complete MySQL connection configuration', () => {
  assert.throws(
    () => resolveMysqlConfig({ NODE_ENV: 'production', DATA_DRIVER: 'mysql' }),
    /DB_HOST.*DB_NAME.*DB_USER.*DB_PASSWORD/
  );

  const config = resolveMysqlConfig({
    NODE_ENV: 'production',
    DATA_DRIVER: 'mysql',
    DB_HOST: 'mysql.internal',
    DB_PORT: '3307',
    DB_NAME: 'tutor',
    DB_USER: 'tutor_app',
    DB_PASSWORD: 'not-a-real-password',
    DB_CONNECTION_LIMIT: '12',
    DB_SSL_ENABLED: 'true'
  });

  assert.deepEqual(config, {
    host: 'mysql.internal',
    port: 3307,
    database: 'tutor',
    user: 'tutor_app',
    password: 'not-a-real-password',
    connectionLimit: 12,
    sslEnabled: true
  });
});

test('development and test default to the JSON data driver', () => {
  assert.equal(resolveDataDriver({ NODE_ENV: 'development' }), 'json');
  assert.equal(resolveDataDriver({ NODE_ENV: 'test' }), 'json');
  assert.doesNotThrow(() => validateDataConfiguration({ NODE_ENV: 'development' }));
  assert.doesNotThrow(() => validateDataConfiguration({ NODE_ENV: 'test', DATA_DRIVER: 'json' }));
});

test('unsupported data driver fails with an explicit error', () => {
  assert.throws(
    () => resolveDataDriver({ NODE_ENV: 'development', DATA_DRIVER: 'sqlite' }),
    /DATA_DRIVER.*json.*mysql/i
  );
});
