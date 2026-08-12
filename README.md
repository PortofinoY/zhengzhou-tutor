# 郑州大学生上门家教小程序 MVP

本项目按产品文档重新开发，包含四个部分：

- `miniprogram/`：微信小程序用户端
- `server/`：后端 API 与后台管理端静态资源
- `database/schema.sql`：MySQL 当前完整结构
- `database/migrations/`：MySQL 版本化迁移
- `docs/`：接口与验收说明

开发前请先阅读：`docs/DEVELOPMENT_STANDARDS.md`。

MVP 定位为郑州本地大学生家教信息展示、预约撮合和服务留痕平台，不包含线上支付、即时聊天、直播课、课程包和结果承诺。

## 启动

安装依赖：

```bash
npm install
```

启动本地后端与后台管理端（显式启用开发 mock 和演示数据）：

```bash
npm run dev
```

服务默认运行在 `http://127.0.0.1:3000`。

后台管理端地址：

```text
http://127.0.0.1:3000/admin/
```

演示数据只会在 `SEED_DEMO_DATA=true` 的开发或测试环境加载。演示账号不得用于体验版或正式版，仓库不提供可用于生产的默认管理员密码。

小程序开发者工具导入目录：

```text
miniprogram/
```

小程序前端请求地址统一配置在：

```text
miniprogram/utils/config.js
```

开发版默认连接：

```js
API_BASE_URL = 'http://127.0.0.1:3000'
```

微信开发者工具本地联调时，请勾选：

```text
详情 -> 本地设置 -> 不校验合法域名、web-view、TLS版本以及HTTPS证书
```

真机开发调试时，`localhost` 或 `127.0.0.1` 指向手机本机，不是电脑。需要在 `miniprogram/utils/env.js` 的开发配置中使用电脑局域网 IP，例如：

```js
API_BASE_URL = 'http://192.168.x.x:3000'
```

后端通过统一 Store 接口支持两种数据驱动：

- `development/test` 默认使用 `DATA_DRIVER=json`，便于本地开发和测试。
- `production` 必须使用 `DATA_DRIVER=mysql`，禁止依赖容器本地 JSON 文件。

生产服务只校验数据库连接和迁移版本，不会自动建表或自动回退到 JSON。完整迁移与 CloudBase 配置见 `docs/DATABASE_MIGRATION.md` 和 `docs/CLOUDBASE_MYSQL_SETUP.md`。

生产环境启用真实微信登录和手机号授权时，需要在部署平台的环境变量中配置：

```bash
export WECHAT_APPID="<小程序 AppID>"
export WECHAT_SECRET="<小程序 AppSecret>"
npm start
```

后端行为：

- `POST /api/auth/wechat-login`：配置微信参数后调用 `code2Session`；未配置时仅开发环境允许 mock，生产环境返回配置错误。
- `POST /api/auth/bind-phone`：配置微信参数后调用微信手机号接口；未配置时仅开发环境允许 mock，生产环境返回配置错误。
- 请求中带 `devOpenid` 或 `mock_` 前缀 code 时，仅在后端允许 mock 的开发环境生效。
- 后端不会把微信 `openid` 返回给小程序前端页面。

当前项目 `appid` 仍为 `touristappid` 时，微信开发者工具会处于游客模式。游客模式下真实 `wx.login` 和 `getPhoneNumber` 可能触发微信 SDK 内部限制，所以开发环境默认在 `miniprogram/utils/config.js` 中开启：

```js
DEVELOPMENT_MOCK_WECHAT_API = true
```

Mock 开关不再手动修改。小程序会根据微信 `envVersion` 自动隔离：

- `develop`：允许本地后端、测试入口和 mock 能力。
- `trial`：关闭测试入口和 mock，使用 `REMOTE_API_BASE_URLS.trial`。
- `release`：关闭测试入口和 mock，使用 `REMOTE_API_BASE_URLS.release`。

体验版和正式版发布前必须在 `miniprogram/utils/config.js` 分别配置 HTTPS 合法域名。地址缺失、不是 HTTPS 或使用本机地址时会立即报错，不会回退到本机服务。

后端生产启动必须设置：

```bash
export NODE_ENV="production"
export ALLOW_MOCK_FEATURES="false"
export SEED_DEMO_DATA="false"
export DATA_DRIVER="mysql"
export DB_HOST="<MySQL 地址>"
export DB_PORT="3306"
export DB_NAME="<数据库名>"
export DB_USER="<数据库用户>"
export DB_PASSWORD="<数据库密码>"
export DB_CONNECTION_LIMIT="10"
export DB_SSL_ENABLED="false"
export TUTOR_TOKEN_SECRET="<至少32字符的随机密钥>"
export WECHAT_APPID="<小程序 AppID>"
export WECHAT_SECRET="<小程序 AppSecret>"
npm start
```

生产环境即使误将 `ALLOW_MOCK_FEATURES` 或 `SEED_DEMO_DATA` 设为 `true`，服务仍会强制关闭 mock 和演示数据。缺少 Token 密钥或微信配置时，服务会拒绝启动。

首次创建生产管理员时，先完成 MySQL 迁移，再设置一次性初始化变量并执行独立命令：

```bash
export NODE_ENV="production"
export DATA_DRIVER="mysql"
# 同时配置 DB_HOST、DB_PORT、DB_NAME、DB_USER、DB_PASSWORD
export ADMIN_USERNAME="<管理员账号>"
export ADMIN_PASSWORD="<至少12位且包含大小写字母、数字、特殊字符>"
export ADMIN_PHONE="<可选的管理员手机号>"
npm run init-admin
```

初始化命令不会覆盖已有管理员，也不会输出密码。执行完成后应从部署环境中删除 `ADMIN_PASSWORD`。

## MySQL 数据层命令

```bash
# 应用尚未执行的 001-007 迁移
npm run db:migrate

# 默认 dry-run，只读取和校验 JSON，不连接或写入 MySQL
npm run db:import-json

# 显式导入；执行前必须独立备份源 JSON 和目标数据库
npm run db:import-json -- --execute

# 对比源 JSON 与 MySQL 各集合数量并检查关联
npm run db:verify
```

可用 `--source /absolute/path/to/db.json` 指定只读数据源。导入保留原 ID、在单个事务中替换目标快照，重复执行不会叠加重复记录，也不会删除源 JSON。

环境变量清单可参考 `.env.example`。该文件不包含真实值，项目也不会自动加载 `.env`；真实配置应写入部署平台、进程管理器或安全的密钥管理服务。

## 验收重点

- 游客可浏览首页、老师列表、老师详情部分信息。
- 家长登录并绑定手机号后可预约、查看订单、取消、确认完成、评价和投诉。
- 老师登录并绑定手机号后可提交入驻资料；审核通过后可接单、处理订单、查看评价。
- 后台可登录、审核老师、管理用户、管理订单、处理投诉、隐藏评价。
- 服务端强制校验老师展示范围、订单状态流转、详细地址隐私、评价唯一性和投诉状态。
