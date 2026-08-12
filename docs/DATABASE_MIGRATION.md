# JSON 到 MySQL 迁移手册

## 1. 适用范围

本手册用于把 `server/data/db.json` 中已存在的业务数据迁移到 MySQL 8。原 JSON 文件只作为只读迁移源和回滚备份，不会被脚本删除。

## 2. 迁移前准备

1. 停止会继续写入源 JSON 的后端实例，避免迁移期间产生新数据。
2. 将源 JSON 复制到仓库外的受控备份目录。
3. 在 CloudBase 或本地 MySQL 创建空数据库和最小权限应用账号。
4. 在终端或部署平台配置 `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`。
5. 不要把真实密码写入 `.env.example`、README、命令历史或 Git。

## 3. 建表与升级

```bash
DATA_DRIVER=mysql npm run db:migrate
```

迁移工具按文件名顺序执行 `database/migrations/001-007`，使用事务边界并把版本和 SHA-256 校验值写入 `schema_migrations`。已执行文件若被修改，工具会拒绝继续，避免数据库结构漂移。MySQL DDL 会隐式提交，因此建表依赖 `IF NOT EXISTS`，创建索引前会查询 `information_schema`；中断后可重新执行并继续补齐缺失结构。

服务启动不会自动执行迁移。数据库版本低于 7 时会明确拒绝启动。

## 4. 导入前审计

```bash
npm run db:import-json
# 或
npm run db:import-json -- --source /absolute/path/to/db.json
```

默认是 dry-run：只读取集合数量、字段形状和关联关系，不连接或写入目标 MySQL。日志只输出集合名、数量和脱敏记录 ID。

## 5. 正式导入

```bash
DATA_DRIVER=mysql npm run db:import-json -- --execute --source /absolute/path/to/db.json
```

正式导入会先校验 MySQL 连接和结构版本，再在一个事务中写入完整快照。ID 原样保留，金额从元转换为整数分。重复执行会按稳定 ID 覆盖并清理目标中的多余快照行，不会叠加重复数据。

## 6. 导入后核验

```bash
DATA_DRIVER=mysql npm run db:verify -- --source /absolute/path/to/db.json
```

核验工具比较每个集合的源/目标数量，并检查用户、老师、需求、订单、评价、投诉、解锁和日志关联。核验失败时不得切换生产流量。

## 7. 切换生产服务

核验通过后，在部署平台设置 `NODE_ENV=production`、`DATA_DRIVER=mysql` 和全部生产安全变量，再启动服务。先进行健康检查和只读接口检查，然后再开放写流量。

## 8. 回滚

1. 立即停止新 MySQL 实例写流量。
2. 保留失败现场和 MySQL 备份，不要直接删除数据库。
3. 本地开发可切回 `NODE_ENV=development DATA_DRIVER=json` 并使用迁移前备份。
4. production 不允许切回 JSON；生产回滚应恢复上一份 MySQL 备份和上一版本服务。
5. 核对切换窗口内是否产生新数据，必要时人工合并后再重试。

## 9. 当前设计取舍

本阶段不启用数据库外键，以避免历史 JSON 中的可修复关联问题阻断建库。服务端通过单事务快照、导入前关联校验和导入后核验保证一致性。当前 MySQL Store 使用全局业务写锁串行化写请求，优先保证迁移兼容与一致性；高并发前应继续拆分为按业务聚合的行级 Repository 事务。
