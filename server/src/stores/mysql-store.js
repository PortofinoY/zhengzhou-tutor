const {
  Store,
  DATA_TABLES,
  deepClone,
  emptyData
} = require('../store');
const { TABLE_DEFINITIONS } = require('../database/table-definitions');
const { TableRepository } = require('../repositories/table-repository');

const REQUIRED_SCHEMA_VERSION = 7;

class MysqlStore extends Store {
  constructor(options = {}) {
    super('/mysql-store-not-a-file', {
      seedDemoData: false,
      environment: { NODE_ENV: 'production' }
    });
    if (!options.pool) throw new Error('MysqlStore 需要 MySQL 连接池');
    this.driver = 'mysql';
    this.pool = options.pool;
    this.requiredSchemaVersion = options.requiredSchemaVersion || REQUIRED_SCHEMA_VERSION;
    this.repositoryFactory = options.repositoryFactory || ((connection, definition) => (
      new TableRepository(connection, definition)
    ));
    this.connection = null;
    this.dirty = false;
    this.beforeRequest = null;
    this.initialized = false;
  }

  async assertSchemaVersion(connection) {
    let rows;
    try {
      [rows] = await connection.query(
        'SELECT `version` FROM `schema_migrations` ORDER BY `version` DESC LIMIT 1'
      );
    } catch (error) {
      throw new Error(`MySQL 数据库结构未初始化：${error.message}`);
    }
    const version = rows.length ? Number(rows[0].version) : 0;
    if (version < this.requiredSchemaVersion) {
      throw new Error(
        `MySQL 数据库迁移版本过低：当前 ${version}，要求 ${this.requiredSchemaVersion}。请先执行 npm run db:migrate`
      );
    }
  }

  async readSnapshot(connection, { forUpdate = false } = {}) {
    const data = emptyData();
    const [sequences] = await connection.query(
      `SELECT \`entity_name\`, \`next_id\` FROM \`app_sequences\`${forUpdate ? ' FOR UPDATE' : ''}`
    );
    sequences.forEach((row) => {
      data.meta.nextIds[row.entity_name] = Number(row.next_id);
    });

    for (const tableName of DATA_TABLES) {
      const definition = TABLE_DEFINITIONS[tableName];
      if (!definition) throw new Error(`缺少 MySQL 表映射：${tableName}`);
      const repository = this.repositoryFactory(connection, definition);
      data[tableName] = await repository.loadAll({ forUpdate });
      if (!data.meta.nextIds[tableName]) {
        data.meta.nextIds[tableName] = data[tableName].reduce(
          (max, row) => Math.max(max, Number(row.id) || 0),
          0
        ) + 1;
      }
    }
    return data;
  }

  async initialize() {
    const connection = await this.pool.getConnection();
    try {
      await this.assertSchemaVersion(connection);
      this.data = await this.readSnapshot(connection);
      this.ensureShape();
      this.initialized = true;
      return this;
    } finally {
      connection.release();
    }
  }

  load() {
    if (!this.initialized || !this.data) {
      throw new Error('MysqlStore 尚未初始化，请先 await store.initialize()');
    }
    return this.data;
  }

  table(name) {
    if (!this.data) throw new Error('MysqlStore 当前没有活动数据快照');
    return this.data[name];
  }

  save() {
    if (!this.connection) {
      throw new Error('MySQL 写操作必须在事务中执行');
    }
    this.dirty = true;
  }

  reset() {
    throw new Error('MySQL 数据不得通过 reset() 清空');
  }

  async beginRequest() {
    if (this.connection) throw new Error('MysqlStore 不支持嵌套请求事务');
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('SELECT `id` FROM `app_state_lock` WHERE `id` = 1 FOR UPDATE');
      this.connection = connection;
      this.data = await this.readSnapshot(connection, { forUpdate: true });
      this.ensureShape();
      this.beforeRequest = deepClone(this.data);
      this.dirty = false;
    } catch (error) {
      try {
        await connection.rollback();
      } finally {
        connection.release();
      }
      throw error;
    }
  }

  async persistSnapshot() {
    await this.connection.query('DELETE FROM `app_sequences`');
    for (const [entityName, nextId] of Object.entries(this.data.meta.nextIds)) {
      await this.connection.query(
        'INSERT INTO `app_sequences` (`entity_name`, `next_id`) VALUES (?, ?)',
        [entityName, Number(nextId)]
      );
    }
    for (const tableName of DATA_TABLES) {
      const repository = this.repositoryFactory(this.connection, TABLE_DEFINITIONS[tableName]);
      await repository.replaceAll(this.data[tableName] || []);
    }
  }

  async commitRequest() {
    if (!this.connection) return;
    const connection = this.connection;
    try {
      if (this.dirty) await this.persistSnapshot();
      await connection.commit();
      this.beforeRequest = null;
      this.dirty = false;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
      this.data = this.beforeRequest || this.data;
      throw error;
    } finally {
      this.connection = null;
      connection.release();
    }
  }

  async rollbackRequest() {
    if (!this.connection) return;
    const connection = this.connection;
    try {
      await connection.rollback();
    } finally {
      this.data = this.beforeRequest || this.data;
      this.beforeRequest = null;
      this.dirty = false;
      this.connection = null;
      connection.release();
    }
  }

  async transaction(work) {
    await this.beginRequest();
    try {
      const result = await work(this);
      await this.commitRequest();
      return result;
    } catch (error) {
      await this.rollbackRequest();
      throw error;
    }
  }

  async close() {
    if (this.connection) await this.rollbackRequest();
    await this.pool.end();
  }
}

module.exports = {
  MysqlStore,
  REQUIRED_SCHEMA_VERSION
};
