class TableRepository {
  constructor(connection, definition) {
    if (!connection) throw new Error('TableRepository 需要数据库连接');
    if (!definition || !definition.table || !definition.fields) throw new Error('TableRepository 定义不完整');
    this.connection = connection;
    this.definition = definition;
  }

  encodeRow(row) {
    const result = {};
    Object.entries(this.definition.fields).forEach(([property, config]) => {
      if (!Object.prototype.hasOwnProperty.call(row, property)) return;
      const value = row[property];
      result[config.column] = config.serialize && value !== null && value !== undefined
        ? config.serialize(value)
        : value;
    });
    return result;
  }

  decodeRow(row) {
    const result = {};
    Object.entries(this.definition.fields).forEach(([property, config]) => {
      if (!Object.prototype.hasOwnProperty.call(row, config.column)) return;
      const value = row[config.column];
      if (value === null || value === undefined) return;
      result[property] = config.parse ? config.parse(value) : value;
    });
    return result;
  }

  async loadAll({ forUpdate = false } = {}) {
    const suffix = forUpdate ? ' FOR UPDATE' : '';
    const [rows] = await this.connection.query(
      `SELECT * FROM \`${this.definition.table}\` ORDER BY \`${this.definition.idColumn}\`${suffix}`
    );
    return rows.map((row) => this.decodeRow(row));
  }

  async upsert(row) {
    const encoded = this.encodeRow(row);
    const columns = Object.keys(encoded);
    if (columns.length === 0) throw new Error(`不能向 ${this.definition.table} 写入空记录`);
    const updates = columns
      .filter((column) => column !== this.definition.idColumn)
      .map((column) => `\`${column}\` = VALUES(\`${column}\`)`)
      .join(', ');
    const sql = [
      `INSERT INTO \`${this.definition.table}\` (${columns.map((column) => `\`${column}\``).join(', ')})`,
      `VALUES (${columns.map(() => '?').join(', ')})`,
      updates ? `ON DUPLICATE KEY UPDATE ${updates}` : ''
    ].filter(Boolean).join(' ');
    await this.connection.query(sql, columns.map((column) => encoded[column]));
  }

  async replaceAll(rows) {
    const ids = rows.map((row) => Number(row.id)).filter(Number.isFinite);
    if (ids.length === 0) {
      await this.connection.query(`DELETE FROM \`${this.definition.table}\``);
    } else {
      await this.connection.query(
        `DELETE FROM \`${this.definition.table}\` WHERE \`${this.definition.idColumn}\` NOT IN (${ids.map(() => '?').join(', ')})`,
        ids
      );
    }
    for (const row of rows) {
      await this.upsert(row);
    }
  }
}

module.exports = {
  TableRepository
};
