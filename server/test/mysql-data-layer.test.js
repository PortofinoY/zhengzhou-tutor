const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { TABLE_DEFINITIONS } = require('../src/database/table-definitions');
const { TableRepository } = require('../src/repositories/table-repository');
const { withTransaction } = require('../src/database/transaction');

test('complete schema covers every persisted table and mapped column', () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');
  Object.values(TABLE_DEFINITIONS).forEach((definition) => {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${definition.table}\\s*\\(`));
    Object.values(definition.fields).forEach((mapping) => {
      assert.match(schema, new RegExp(`\\b${mapping.column}\\b`), `${definition.table}.${mapping.column}`);
    });
  });
});

function fakeConnection() {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      return [[], []];
    },
    async beginTransaction() {
      calls.push({ method: 'beginTransaction' });
    },
    async commit() {
      calls.push({ method: 'commit' });
    },
    async rollback() {
      calls.push({ method: 'rollback' });
    },
    release() {
      calls.push({ method: 'release' });
    }
  };
}

test('repository maps user JSON fields without changing the API shape', () => {
  const repository = new TableRepository(fakeConnection(), TABLE_DEFINITIONS.users);
  const source = {
    id: 7,
    openid: 'openid-value',
    roles: ['parent', 'teacher'],
    currentRole: 'parent',
    profileStatus: 'completed',
    accountStatus: 'normal',
    registeredAt: '2026-07-30T10:00:00.000Z',
    updatedAt: '2026-07-30T10:00:00.000Z'
  };
  const encoded = repository.encodeRow(source);
  assert.equal(encoded.roles_json, JSON.stringify(source.roles));
  const decoded = repository.decodeRow(encoded);
  assert.deepEqual(decoded.roles, source.roles);
  assert.equal(decoded.currentRole, 'parent');
});

test('optional unique identity fields store empty values as NULL', () => {
  const repository = new TableRepository(fakeConnection(), TABLE_DEFINITIONS.users);
  const encoded = repository.encodeRow({
    id: 8,
    openid: '',
    phone: '',
    accountUsername: ''
  });
  assert.equal(encoded.openid, null);
  assert.equal(encoded.phone, null);
  assert.equal(encoded.account_username, null);
});

test('repository stores teacher and requirement money as integer cents', () => {
  const teacherRepository = new TableRepository(fakeConnection(), TABLE_DEFINITIONS.teachers);
  const requirementRepository = new TableRepository(fakeConnection(), TABLE_DEFINITIONS.parentRequirements);

  const teacherEncoded = teacherRepository.encodeRow({
    id: 1,
    userId: 2,
    hourlyRate: 80,
    serviceAreas: ['金水区'],
    availableTimes: ['周六下午']
  });
  const requirementEncoded = requirementRepository.encodeRow({
    id: 3,
    parentUserId: 1,
    budgetPrice: 90
  });

  assert.equal(teacherEncoded.hourly_rate_cents, 8000);
  assert.equal(requirementEncoded.budget_price_cents, 9000);
  assert.equal(teacherRepository.decodeRow(teacherEncoded).hourlyRate, 80);
  assert.equal(requirementRepository.decodeRow(requirementEncoded).budgetPrice, 90);
});

test('repository maps current order fields and uses parameterized upsert queries', async () => {
  const connection = fakeConnection();
  const repository = new TableRepository(connection, TABLE_DEFINITIONS.orders);
  const maliciousNote = `测试'); DROP TABLE tutor_orders; --`;
  const row = {
    id: 9,
    orderNo: 'TO202607300009',
    parentUserId: 1,
    teacherId: 2,
    subject: '数学',
    studentGrade: '初二',
    appointmentDate: '2026-08-02',
    startTime: '10:00',
    endTime: '11:00',
    serviceArea: '金水区',
    address: '测试地址',
    contactName: '测试家长',
    contactPhone: '13900000000',
    note: maliciousNote,
    status: 'pending_teacher',
    createdAt: '2026-07-30T10:00:00.000Z',
    updatedAt: '2026-07-30T10:00:00.000Z'
  };

  await repository.upsert(row);
  const query = connection.calls.find((call) => call.sql);
  assert.ok(query);
  assert.match(query.sql, /INSERT INTO `tutor_orders`/);
  assert.match(query.sql, /VALUES \(\?,/);
  assert.equal(query.sql.includes(maliciousNote), false);
  assert.equal(query.params.includes(maliciousNote), true);
  assert.deepEqual(repository.decodeRow(repository.encodeRow(row)), row);
});

test('transaction commits on success and always releases the connection', async () => {
  const connection = fakeConnection();
  const pool = { getConnection: async () => connection };

  const value = await withTransaction(pool, async (activeConnection) => {
    assert.equal(activeConnection, connection);
    return 'ok';
  });

  assert.equal(value, 'ok');
  assert.deepEqual(
    connection.calls.filter((call) => call.method).map((call) => call.method),
    ['beginTransaction', 'commit', 'release']
  );
});

test('transaction rolls back on failure and always releases the connection', async () => {
  const connection = fakeConnection();
  const pool = { getConnection: async () => connection };

  await assert.rejects(
    () => withTransaction(pool, async () => {
      throw new Error('forced failure');
    }),
    /forced failure/
  );

  assert.deepEqual(
    connection.calls.filter((call) => call.method).map((call) => call.method),
    ['beginTransaction', 'rollback', 'release']
  );
});
