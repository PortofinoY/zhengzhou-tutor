# CloudBase MySQL 配置说明

## 1. 需要在控制台手工完成

1. 在微信云开发/CloudBase 环境中开通 MySQL，并记录内网连接地址、端口和数据库名。
2. 创建独立应用账号，只授予目标数据库所需的读写和建表权限；迁移完成后可收紧建表权限。
3. 确认云托管服务与 MySQL 位于可互通的环境和网络。
4. 在云托管环境变量或密钥管理中配置数据库、Token 和微信参数。
5. 在发布前的维护窗口执行迁移、JSON 导入和核验命令。
6. 配置数据库自动备份、保留周期和恢复演练。

## 2. 数据库环境变量

| 变量 | 用途 |
| --- | --- |
| `DATA_DRIVER=mysql` | 选择 MySQL 数据驱动 |
| `DB_HOST` | CloudBase MySQL 内网地址 |
| `DB_PORT` | MySQL 端口，默认 3306 |
| `DB_NAME` | 业务数据库名 |
| `DB_USER` | 应用数据库账号 |
| `DB_PASSWORD` | 数据库密码，必须放入密钥配置 |
| `DB_CONNECTION_LIMIT` | 连接池上限，初始建议 10，再按监控调整 |
| `DB_SSL_ENABLED` | 连接环境要求 TLS 时设为 true |

生产还必须配置 `TUTOR_TOKEN_SECRET`、`WECHAT_APPID`、`WECHAT_SECRET`，并保持 `ALLOW_MOCK_FEATURES=false`、`SEED_DEMO_DATA=false`。

## 3. 推荐执行顺序

```bash
npm ci
DATA_DRIVER=mysql npm run db:migrate
npm run db:import-json
DATA_DRIVER=mysql npm run db:import-json -- --execute
DATA_DRIVER=mysql npm run db:verify
NODE_ENV=production DATA_DRIVER=mysql npm start
```

首次管理员必须在迁移完成后使用 `npm run init-admin` 显式创建。不要在 SQL、镜像、前端代码或仓库中保存管理员明文密码。

## 4. 上线检查

- MySQL 迁移版本为 7。
- 导入核验全部通过。
- 云托管启动日志不包含手机号、openid、密码哈希或数据库密码。
- 生产实例无法使用 JSON、演示种子和 mock 支付。
- 老师未接受订单前，后端不返回家长完整联系方式。
- 已配置数据库告警、慢查询监控、连接数监控和每日备份。

## 5. 本轮未自动执行

Codex 不会连接真实 CloudBase、填写真实数据库凭据、迁移生产数据或调整控制台网络。以上操作必须由项目所有者在已备份、可回滚的维护窗口中完成。
