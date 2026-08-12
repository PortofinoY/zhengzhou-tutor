const fs = require('fs');
const { DATA_TABLES, deepClone, emptyData } = require('../store');

function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('JSON 数据文件根节点必须是对象');
  }
  const snapshot = emptyData();
  for (const table of DATA_TABLES) {
    if (raw[table] !== undefined && !Array.isArray(raw[table])) {
      throw new Error(`数据集合 ${table} 必须是数组`);
    }
    snapshot[table] = deepClone(raw[table] || []);
    const ids = snapshot[table].map((row) => Number(row.id)).filter(Number.isFinite);
    snapshot.meta.nextIds[table] = Math.max(
      Number(raw.meta && raw.meta.nextIds && raw.meta.nextIds[table]) || 1,
      ids.length ? Math.max(...ids) + 1 : 1
    );
  }
  return snapshot;
}

function loadJsonSnapshot(sourcePath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error('找不到 JSON 数据源文件');
  return normalizeSnapshot(JSON.parse(fs.readFileSync(sourcePath, 'utf8')));
}

function relationErrors(snapshot) {
  const errors = [];
  const ids = (table) => new Set(snapshot[table].map((row) => Number(row.id)));
  const users = ids('users');
  const teachers = ids('teachers');
  const orders = ids('orders');
  const admins = ids('admins');
  const check = (table, field, validIds, optional = false) => {
    snapshot[table].forEach((row) => {
      const value = Number(row[field]);
      if ((optional && !value) || validIds.has(value)) return;
      errors.push(`${table}#${row.id || '?'} 的 ${field} 关联不存在`);
    });
  };

  check('parentProfiles', 'userId', users);
  check('teachers', 'userId', users);
  check('teacherSubjects', 'teacherId', teachers);
  check('teacherCertifications', 'teacherId', teachers);
  check('parentRequirements', 'parentUserId', users);
  check('orders', 'parentUserId', users);
  check('orders', 'teacherId', teachers);
  check('orderStatusLogs', 'orderId', orders);
  check('reviews', 'orderId', orders);
  check('reviews', 'parentUserId', users);
  check('reviews', 'teacherId', teachers);
  check('complaints', 'orderId', orders);
  check('complaints', 'complainantUserId', users);
  check('complaints', 'targetUserId', users);
  check('complaints', 'handlerAdminId', admins, true);
  check('paymentOrders', 'buyerUserId', users);
  check('unlockRecords', 'buyerUserId', users);
  check('contactLogs', 'userId', users);
  check('adminLoginTickets', 'adminId', admins);
  check('operationLogs', 'adminId', admins, true);
  check('uploadedFiles', 'ownerUserId', users);
  return errors;
}

function countsOf(snapshot) {
  return Object.fromEntries(DATA_TABLES.map((table) => [table, snapshot[table].length]));
}

function logCounts(logger, counts, prefix) {
  for (const table of DATA_TABLES) logger.info(`${prefix} ${table}: ${counts[table]}`);
}

async function importJsonSnapshot(options) {
  const {
    sourcePath,
    targetStore,
    execute = false,
    logger = console
  } = options;
  const snapshot = loadJsonSnapshot(sourcePath);
  const counts = countsOf(snapshot);
  const errors = relationErrors(snapshot);
  logCounts(logger, counts, '读取');
  if (errors.length > 0) {
    errors.forEach((message) => logger.info(`校验失败: ${message}`));
    throw new Error(`JSON 数据关联校验失败，共 ${errors.length} 项`);
  }
  if (!execute) {
    logger.info('当前为 dry-run，未写入目标数据库');
    return { mode: 'dry-run', counts, written: {}, skipped: counts, failed: 0 };
  }
  if (!targetStore || typeof targetStore.transaction !== 'function') {
    throw new Error('正式导入需要可事务写入的目标 Store');
  }

  await targetStore.transaction(async (store) => {
    store.data = deepClone(snapshot);
    if (typeof store.ensureShape === 'function') store.ensureShape();
    store.save();
  });
  logCounts(logger, counts, '写入');
  return { mode: 'execute', counts, written: counts, skipped: {}, failed: 0 };
}

function compareSnapshots(source, target) {
  const sourceCounts = countsOf(source);
  const targetCounts = countsOf(target);
  const mismatches = DATA_TABLES
    .filter((table) => sourceCounts[table] !== targetCounts[table])
    .map((table) => `${table}: source=${sourceCounts[table]}, target=${targetCounts[table]}`);
  const targetRelationErrors = relationErrors(target);
  return {
    sourceCounts,
    targetCounts,
    mismatches,
    relationErrors: targetRelationErrors,
    valid: mismatches.length === 0 && targetRelationErrors.length === 0
  };
}

module.exports = {
  normalizeSnapshot,
  loadJsonSnapshot,
  relationErrors,
  countsOf,
  importJsonSnapshot,
  compareSnapshots
};
