const assert = require('node:assert/strict');
const test = require('node:test');
const { emptyData } = require('../src/store');
const { createAdmin } = require('../../scripts/init-admin');

function mysqlLikeStore() {
  const store = {
    driver: 'mysql',
    data: emptyData(),
    transactions: 0,
    table(name) { return this.data[name]; },
    nextId(name) {
      const id = this.data.meta.nextIds[name]++;
      return id;
    },
    save() {},
    insert(name, row) {
      const value = { id: this.nextId(name), ...row };
      this.data[name].push(value);
      this.save();
      return value;
    },
    async transaction(work) {
      this.transactions += 1;
      return work(this);
    }
  };
  return store;
}

test('administrator initialization writes through a MySQL-compatible transaction', async () => {
  const store = mysqlLikeStore();
  const password = 'Secure@Test123';
  const admin = await createAdmin(store, {
    username: 'cloud_admin',
    phone: '13900001111',
    password
  });
  assert.equal(store.driver, 'mysql');
  assert.equal(store.transactions, 1);
  assert.equal(admin.username, 'cloud_admin');
  assert.notEqual(admin.passwordHash, password);
});

test('administrator initialization refuses duplicate username or phone', async () => {
  const store = mysqlLikeStore();
  await createAdmin(store, {
    username: 'cloud_admin',
    phone: '13900001111',
    password: 'Secure@Test123'
  });
  await assert.rejects(
    () => createAdmin(store, {
      username: 'cloud_admin',
      phone: '13900002222',
      password: 'Another@Test123'
    }),
    /已存在/
  );
});
