# 郑州大学生上门家教小程序 MVP

本项目按产品文档重新开发，包含四个部分：

- `miniprogram/`：微信小程序用户端
- `server/`：后端 API 与后台管理端静态资源
- `database/schema.sql`：关系型数据库字段设计
- `docs/`：接口与验收说明

MVP 定位为郑州本地大学生家教信息展示、预约撮合和服务留痕平台，不包含线上支付、即时聊天、直播课、课程包和结果承诺。

## 启动

安装依赖：

```bash
npm install
```

启动本地后端与后台管理端：

```bash
npm start
```

服务默认运行在 `http://127.0.0.1:3000`。

后台管理端地址：

```text
http://127.0.0.1:3000/admin/
```

默认管理员账号：

```text
账号：admin
密码：Admin@123456

账号：18800000001
密码：Admin@123456

账号：18800000002
密码：Admin@123456
```

小程序开发者工具导入目录：

```text
miniprogram/
```

小程序前端请求地址统一配置在：

```text
miniprogram/utils/config.js
```

开发环境默认：

```js
API_BASE_URL = 'http://127.0.0.1:3000'
```

微信开发者工具本地联调时，请勾选：

```text
详情 -> 本地设置 -> 不校验合法域名、web-view、TLS版本以及HTTPS证书
```

真机调试时，`localhost` 或 `127.0.0.1` 指向手机本机，不是电脑。需要把 `API_BASE_URL` 改成电脑局域网 IP，例如：

```js
API_BASE_URL = 'http://192.168.x.x:3000'
```

当前后端是本地 JSON 持久化的 MVP API，内置演示数据与开发环境 mock 微信登录/手机号授权逻辑。后端已预留真实微信 `code2Session` 和手机号授权换取接口。

生产环境启用真实微信登录和手机号授权时，需要在启动后端前配置：

```bash
export WECHAT_APPID="正式小程序 AppID"
export WECHAT_SECRET="正式小程序 AppSecret"
npm start
```

后端行为：

- `POST /api/auth/wechat-login`：有 `WECHAT_APPID` 和 `WECHAT_SECRET` 时，会调用微信 `code2Session` 换取 `openid`；未配置时保留本地 mock，方便开发者工具预览。
- `POST /api/auth/bind-phone`：有 `WECHAT_APPID` 和 `WECHAT_SECRET` 时，会调用微信手机号授权接口换取手机号；未配置时继续使用开发 mock 手机号。
- 请求中带 `devOpenid` 或 `mock_` 前缀 code 时，始终走开发 mock，便于自动化测试和本地演示。
- 后端不会把微信 `openid` 返回给小程序前端页面。

当前项目 `appid` 仍为 `touristappid` 时，微信开发者工具会处于游客模式。游客模式下真实 `wx.login` 和 `getPhoneNumber` 可能触发微信 SDK 内部限制，所以开发环境默认在 `miniprogram/utils/config.js` 中开启：

```js
DEVELOPMENT_MOCK_WECHAT_API = true
```

接入正式小程序 AppID 和微信服务端能力后，再将该开关改为 `false`。

真实微信登录联调时，小程序端需要同时检查：

```js
DEVELOPMENT_MOCK_WECHAT_API = false
```

关闭后：

- 登录页会调用真实 `wx.login`，并把微信返回的 `code` 发送到 `/api/auth/wechat-login`。
- 手机号授权页会使用 `open-type="getPhoneNumber"`，并把微信返回的手机号授权 `code` 发送到 `/api/auth/bind-phone`。
- `DEVELOPMENT_MOCK_OPENID` 只在 `DEVELOPMENT_MOCK_WECHAT_API = true` 时生效，真实微信联调不会再向后端发送 `devOpenid`。

## 验收重点

- 游客可浏览首页、老师列表、老师详情部分信息。
- 家长登录并绑定手机号后可预约、查看订单、取消、确认完成、评价和投诉。
- 老师登录并绑定手机号后可提交入驻资料；审核通过后可接单、处理订单、查看评价。
- 后台可登录、审核老师、管理用户、管理订单、处理投诉、隐藏评价。
- 服务端强制校验老师展示范围、订单状态流转、详细地址隐私、评价唯一性和投诉状态。
