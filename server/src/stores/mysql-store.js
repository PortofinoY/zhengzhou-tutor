const {
  Store,
  DATA_TABLES,
  deepClone,
  emptyData
} = require('../store');
const { TABLE_DEFINITIONS } = require('../database/table-definitions');
const { TableRepository } = require('../repositories/table-repository');

const REQUIRED_SCHEMA_VERSION = 7;

class MysqlRequestStore extends Store {
  constructor(parent, { readOnly = false } = {}) {
    super('/mysql-request-store-not-a-file', {
      seedDemoData: false,
      environment: { NODE_ENV: 'production' }
    });
    this.driver = 'mysql';
    this.parent = parent;
    this.pool = parent.pool;
    this.readOnly = readOnly;
    this.connection = null;
    this.dirty = false;
    this.beforeRequest = null;
  }

  load() {
    if (!this.data) throw new Error('MySQL 请求数据快照尚未加载');
    return this.data;
  }

  save() {
    if (this.readOnly) throw new Error('只读请求不能写入 MySQL 数据');
    if (!this.connection) throw new Error('MySQL 写操作必须在事务中执行');
    this.dirty = true;
  }

  reset() {
    throw new Error('MySQL 数据不得通过 reset() 清空');
  }

  async beginRequest() {
    if (this.data || this.connection) throw new Error('MysqlRequestStore 不支持嵌套请求事务');

    if (this.readOnly) {
      const connection = await this.pool.getConnection();
      try {
        this.data = await this.parent.readSnapshot(connection);
        this.ensureShape();
      } finally {
        connection.release();
      }
      return;
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      // 当前写入仍是全量快照替换，写请求必须串行以避免快照相互覆盖。
      await connection.query('SELECT `id` FROM `app_state_lock` WHERE `id` = 1 FOR UPDATE');
      this.connection = connection;
      this.data = await this.parent.readSnapshot(connection, { forUpdate: true });
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

  async commitRequest() {
    if (this.readOnly || !this.connection) return;
    const connection = this.connection;
    try {
      if (this.dirty) await this.parent.persistSnapshot(connection, this.data);
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
      this.beforeRequest = null;
      this.dirty = false;
      throw error;
    } finally {
      this.connection = null;
      connection.release();
    }
  }

  async rollbackRequest() {
    if (this.readOnly || !this.connection) return;
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
}

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
      this.initialized = true;
      return this;
    } finally {
      connection.release();
    }
  }

  load() {
    if (!this.initialized) {
      throw new Error('MysqlStore 尚未初始化，请先 await store.initialize()');
    }
    throw new Error('MysqlStore 必须通过请求上下文读取数据');
  }

  table(name) {
    throw new Error(`MysqlStore 必须通过请求上下文读取数据：${name}`);
  }

  save() {
    throw new Error('MysqlStore 必须通过请求上下文写入数据');
  }

  reset() {
    throw new Error('MySQL 数据不得通过 reset() 清空');
  }

  createRequestStore({ readOnly = false } = {}) {
    if (!this.initialized) throw new Error('MysqlStore 尚未初始化，请先 await store.initialize()');
    return new MysqlRequestStore(this, { readOnly });
  }

  async persistSnapshot(connection, data) {
    await connection.query('DELETE FROM `app_sequences`');
    for (const [entityName, nextId] of Object.entries(data.meta.nextIds)) {
      await connection.query(
        'INSERT INTO `app_sequences` (`entity_name`, `next_id`) VALUES (?, ?)',
        [entityName, Number(nextId)]
      );
    }
    for (const tableName of DATA_TABLES) {
      const repository = this.repositoryFactory(connection, TABLE_DEFINITIONS[tableName]);
      await repository.replaceAll(data[tableName] || []);
    }
  }

  async transaction(work) {
    const requestStore = this.createRequestStore({ readOnly: false });
    return requestStore.transaction(work);
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = {
  MysqlStore,
  MysqlRequestStore,
  REQUIRED_SCHEMA_VERSION
};
